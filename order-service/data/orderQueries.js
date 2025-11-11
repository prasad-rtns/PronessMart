const { getPool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Order Data Access Layer
 * All database queries related to Order model (MySQL)
 * All SQL operations with transaction support
 */

class OrderQueries {
  /**
   * Create order with items in a single transaction
   */
  async createOrderWithItems(orderData, orderItems) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      logger.info(`Transaction started for creating order ${orderData.orderNumber}`);

      // Insert order
      const insertOrderQuery = `
        INSERT INTO orders (
          id, user_id, quote_id, order_number, status, subtotal, discount, 
          shipping_cost, tax, total, payment_method, payment_status,
          shipping_address, billing_address, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await connection.query(insertOrderQuery, [
        orderData.id,
        orderData.userId,
        orderData.cartId,
        orderData.orderNumber,
        orderData.status || 'pending',
        orderData.subtotal,
        orderData.discount || 0,
        orderData.shippingCost || 0,
        orderData.tax || 0,
        orderData.total,
        orderData.paymentMethod,
        orderData.paymentStatus || 'pending',
        JSON.stringify(orderData.shippingAddress),
        JSON.stringify(orderData.billingAddress),
        orderData.notes || null
      ]);

      logger.info(`Order ${orderData.orderNumber} inserted into database`);

      // Insert order items
      const insertItemQuery = `
        INSERT INTO order_items (order_id, product_id, product_name, sku, price, quantity, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      for (const item of orderItems) {
        await connection.query(insertItemQuery, [
          orderData.id,
          item.productId,
          item.productName,
          item.sku,
          item.price,
          item.quantity,
          item.subtotal
        ]);
      }

      logger.info(`${orderItems.length} order items inserted for order ${orderData.orderNumber}`);

      await connection.commit();
      logger.info(`Transaction committed successfully for order ${orderData.orderNumber}`);

      return orderData.id;
    } catch (error) {
      await connection.rollback();
      logger.error(`Transaction rolled back for order creation: ${error.message}`);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Update order status with transaction
   */
  async updateOrderStatus(orderId, newStatus, userId) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      logger.info(`Transaction started for updating order ${orderId} status to ${newStatus}`);

      // Get current order
      const [orders] = await connection.query(
        'SELECT * FROM orders WHERE id = ?',
        [orderId]
      );

      if (orders.length === 0) {
        throw new Error('Order not found');
      }

      const order = orders[0];

      // Check ownership
      if (order.user_id !== userId) {
        throw new Error('Unauthorized to update this order');
      }

      // Prevent status updates for completed or cancelled orders
      if (['delivered', 'cancelled'].includes(order.status)) {
        throw new Error(`Cannot update order with status: ${order.status}`);
      }

      // Update status
      const [result] = await connection.query(
        'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
        [newStatus, orderId]
      );

      if (result.affectedRows === 0) {
        throw new Error('Failed to update order status');
      }

      logger.info(`Order ${orderId} status updated from ${order.status} to ${newStatus}`);

      await connection.commit();
      logger.info(`Transaction committed for order ${orderId} status update`);

      // Return old status for event publishing
      return {
        success: true,
        oldStatus: order.status,
        order: order
      };
    } catch (error) {
      await connection.rollback();
      logger.error(`Transaction rolled back for order ${orderId}: ${error.message}`);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Update payment status with transaction and optional status update
   */
  async updateOrderPaymentStatus(orderId, paymentStatus, userId) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      logger.info(`Transaction started for updating payment status of order ${orderId}`);

      // Get current order
      const [orders] = await connection.query(
        'SELECT * FROM orders WHERE id = ?',
        [orderId]
      );

      if (orders.length === 0) {
        throw new Error('Order not found');
      }

      const order = orders[0];

      // Check ownership
      if (order.user_id !== userId) {
        throw new Error('Unauthorized to update this order');
      }

      // Update payment status
      const [result] = await connection.query(
        'UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?',
        [paymentStatus, orderId]
      );

      if (result.affectedRows === 0) {
        throw new Error('Failed to update payment status');
      }

      // If payment is successful and order is pending, update to confirmed
      let statusUpdated = false;
      if (paymentStatus === 'paid' && order.status === 'pending') {
        await connection.query(
          'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
          ['confirmed', orderId]
        );
        statusUpdated = true;
        logger.info(`Order ${orderId} status updated to confirmed after successful payment`);
      }

      await connection.commit();
      logger.info(`Transaction committed for order ${orderId} payment status update`);

      return {
        success: true,
        oldPaymentStatus: order.payment_status,
        statusUpdated: statusUpdated,
        order: order
      };
    } catch (error) {
      await connection.rollback();
      logger.error(`Transaction rolled back for order ${orderId} payment update: ${error.message}`);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get order items by order ID
   */
  async getOrderItems(orderId) {
    const pool = getPool();

    try {
      const [items] = await pool.query(
        'SELECT * FROM order_items WHERE order_id = ?',
        [orderId]
      );

      return items;
    } catch (error) {
      logger.error(`Error in getOrderItems query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find order by ID
   */
  async findById(orderId) {
    const pool = getPool();

    try {
      const [orders] = await pool.query(
        'SELECT * FROM orders WHERE id = ?',
        [orderId]
      );

      if (orders.length === 0) {
        return null;
      }

      const order = orders[0];

      // Get order items
      const [items] = await pool.query(
        'SELECT * FROM order_items WHERE order_id = ?',
        [orderId]
      );

      order.items = items;
      
      // Parse JSON fields
      try {
        order.shippingAddress = typeof order.shipping_address === 'string'
          ? JSON.parse(order.shipping_address)
          : order.shipping_address;

        order.billingAddress = typeof order.billing_address === 'string'
          ? JSON.parse(order.billing_address)
          : order.billing_address;
      } catch (err) {
        logger.warn(`Failed to parse address JSON for order ${order.id}: ${err.message}`);
        order.shippingAddress = order.shipping_address;
        order.billingAddress = order.billing_address;
      }

      return order;
    } catch (error) {
      logger.error(`Error in findById query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find order by order number
   */
  async findByOrderNumber(orderNumber) {
    const pool = getPool();

    try {
      const [orders] = await pool.query(
        'SELECT * FROM orders WHERE order_number = ?',
        [orderNumber]
      );

      if (orders.length === 0) {
        return null;
      }

      const order = orders[0];

      // Get order items
      const [items] = await pool.query(
        'SELECT * FROM order_items WHERE order_id = ?',
        [order.id]
      );

      order.items = items;
      
      // Parse JSON fields
      try {
        order.shippingAddress = typeof order.shipping_address === 'string'
          ? JSON.parse(order.shipping_address)
          : order.shipping_address;

        order.billingAddress = typeof order.billing_address === 'string'
          ? JSON.parse(order.billing_address)
          : order.billing_address;
      } catch (err) {
        logger.warn(`Failed to parse address JSON for order ${order.id}: ${err.message}`);
        order.shippingAddress = order.shipping_address;
        order.billingAddress = order.billing_address;
      }

      return order;
    } catch (error) {
      logger.error(`Error in findByOrderNumber query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find orders by user ID
   */
  async findByUserId(userId, page = 1, limit = 10) {
    const pool = getPool();
    const offset = (page - 1) * limit;

    try {
      const [orders] = await pool.query(
        'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [userId, limit, offset]
      );

      const [countResult] = await pool.query(
        'SELECT COUNT(*) as total FROM orders WHERE user_id = ?',
        [userId]
      );

      // Get items for each order
      for (const order of orders) {
        const [items] = await pool.query(
          'SELECT * FROM order_items WHERE order_id = ?',
          [order.id]
        );
        order.items = items;
        
        // Parse JSON fields
        try {
          order.shippingAddress = typeof order.shipping_address === 'string'
            ? JSON.parse(order.shipping_address)
            : order.shipping_address;

          order.billingAddress = typeof order.billing_address === 'string'
            ? JSON.parse(order.billing_address)
            : order.billing_address;
        } catch (err) {
          logger.warn(`Failed to parse address JSON for order ${order.id}: ${err.message}`);
          order.shippingAddress = order.shipping_address;
          order.billingAddress = order.billing_address;
        }
      }

      return {
        orders,
        pagination: {
          page,
          limit,
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error in findByUserId query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete order (with transaction)
   */
  async deleteById(orderId) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      logger.info(`Transaction started for deleting order ${orderId}`);

      // Delete order items first (foreign key constraint)
      await connection.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
      logger.info(`Order items deleted for order ${orderId}`);

      // Delete order
      const [result] = await connection.query('DELETE FROM orders WHERE id = ?', [orderId]);
      
      if (result.affectedRows === 0) {
        throw new Error('Order not found');
      }

      await connection.commit();
      logger.info(`Transaction committed for deleting order ${orderId}`);
      
      return true;
    } catch (error) {
      await connection.rollback();
      logger.error(`Transaction rolled back for order deletion: ${error.message}`);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get orders by status
   */
  async findByStatus(status, page = 1, limit = 10) {
    const pool = getPool();
    const offset = (page - 1) * limit;

    try {
      const [orders] = await pool.query(
        'SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [status, limit, offset]
      );

      const [countResult] = await pool.query(
        'SELECT COUNT(*) as total FROM orders WHERE status = ?',
        [status]
      );

      // Get items for each order
      for (const order of orders) {
        const [items] = await pool.query(
          'SELECT * FROM order_items WHERE order_id = ?',
          [order.id]
        );
        order.items = items;
        
        // Parse JSON fields
        try {
          order.shippingAddress = typeof order.shipping_address === 'string'
            ? JSON.parse(order.shipping_address)
            : order.shipping_address;

          order.billingAddress = typeof order.billing_address === 'string'
            ? JSON.parse(order.billing_address)
            : order.billing_address;
        } catch (err) {
          logger.warn(`Failed to parse address JSON for order ${order.id}: ${err.message}`);
          order.shippingAddress = order.shipping_address;
          order.billingAddress = order.billing_address;
        }
      }

      return {
        orders,
        pagination: {
          page,
          limit,
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error in findByStatus query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get orders by date range
   */
  async findByDateRange(startDate, endDate, page = 1, limit = 10) {
    const pool = getPool();
    const offset = (page - 1) * limit;

    try {
      const [orders] = await pool.query(
        'SELECT * FROM orders WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [startDate, endDate, limit, offset]
      );

      const [countResult] = await pool.query(
        'SELECT COUNT(*) as total FROM orders WHERE created_at BETWEEN ? AND ?',
        [startDate, endDate]
      );

      // Get items for each order
      for (const order of orders) {
        const [items] = await pool.query(
          'SELECT * FROM order_items WHERE order_id = ?',
          [order.id]
        );
        order.items = items;
        
        // Parse JSON fields
        try {
          order.shippingAddress = typeof order.shipping_address === 'string'
            ? JSON.parse(order.shipping_address)
            : order.shipping_address;

          order.billingAddress = typeof order.billing_address === 'string'
            ? JSON.parse(order.billing_address)
            : order.billing_address;
        } catch (err) {
          logger.warn(`Failed to parse address JSON for order ${order.id}: ${err.message}`);
          order.shippingAddress = order.shipping_address;
          order.billingAddress = order.billing_address;
        }
      }

      return {
        orders,
        pagination: {
          page,
          limit,
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error in findByDateRange query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get pending orders
   */
  async getPendingOrders(limit = 50) {
    const pool = getPool();

    try {
      const [orders] = await pool.query(
        'SELECT * FROM orders WHERE status = ? ORDER BY created_at ASC LIMIT ?',
        ['pending', limit]
      );

      return orders;
    } catch (error) {
      logger.error(`Error in getPendingOrders query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bulk update order statuses (with transaction)
   */
  async bulkUpdateStatus(orderIds, status) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      logger.info(`Transaction started for bulk updating ${orderIds.length} orders`);

      const placeholders = orderIds.map(() => '?').join(',');
      const query = `UPDATE orders SET status = ?, updated_at = NOW() WHERE id IN (${placeholders})`;
      
      const [result] = await connection.query(query, [status, ...orderIds]);

      await connection.commit();
      logger.info(`Transaction committed for bulk update of ${result.affectedRows} orders`);

      return result.affectedRows;
    } catch (error) {
      await connection.rollback();
      logger.error(`Transaction rolled back for bulk update: ${error.message}`);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get order statistics
   */
  async getOrderStats() {
    const pool = getPool();

    try {
      // Total orders
      const [totalResult] = await pool.query('SELECT COUNT(*) as total FROM orders');

      // Orders by status
      const [statusResult] = await pool.query(`
        SELECT status, COUNT(*) as count 
        FROM orders 
        GROUP BY status
      `);

      // Total revenue
      const [revenueResult] = await pool.query(`
        SELECT SUM(total) as total_revenue 
        FROM orders 
        WHERE payment_status = 'paid'
      `);

      // Average order value
      const [avgResult] = await pool.query(`
        SELECT AVG(total) as avg_order_value 
        FROM orders 
        WHERE payment_status = 'paid'
      `);

      // Orders today
      const [todayResult] = await pool.query(`
        SELECT COUNT(*) as orders_today 
        FROM orders 
        WHERE DATE(created_at) = CURDATE()
      `);

      const statusCounts = {};
      statusResult.forEach(row => {
        statusCounts[row.status] = row.count;
      });

      return {
        totalOrders: totalResult[0].total,
        ordersByStatus: statusCounts,
        totalRevenue: revenueResult[0].total_revenue || 0,
        avgOrderValue: avgResult[0].avg_order_value || 0,
        ordersToday: todayResult[0].orders_today
      };
    } catch (error) {
      logger.error(`Error in getOrderStats query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get revenue by date range
   */
  async getRevenueByDateRange(startDate, endDate) {
    const pool = getPool();

    try {
      const [result] = await pool.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as order_count,
          SUM(total) as revenue
        FROM orders
        WHERE created_at BETWEEN ? AND ?
        AND payment_status = 'paid'
        GROUP BY DATE(created_at)
        ORDER BY date
      `, [startDate, endDate]);

      return result;
    } catch (error) {
      logger.error(`Error in getRevenueByDateRange query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get top selling products
   */
  async getTopSellingProducts(limit = 10) {
    const pool = getPool();

    try {
      const [result] = await pool.query(`
        SELECT 
          product_id,
          product_name,
          SUM(quantity) as total_quantity,
          SUM(subtotal) as total_revenue
        FROM order_items
        GROUP BY product_id, product_name
        ORDER BY total_quantity DESC
        LIMIT ?
      `, [limit]);

      return result;
    } catch (error) {
      logger.error(`Error in getTopSellingProducts query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get customer order count
   */
  async getCustomerOrderCount(userId) {
    const pool = getPool();

    try {
      const [result] = await pool.query(
        'SELECT COUNT(*) as order_count FROM orders WHERE user_id = ?',
        [userId]
      );

      return result[0].order_count;
    } catch (error) {
      logger.error(`Error in getCustomerOrderCount query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get customer lifetime value
   */
  async getCustomerLifetimeValue(userId) {
    const pool = getPool();

    try {
      const [result] = await pool.query(`
        SELECT 
          SUM(total) as lifetime_value,
          COUNT(*) as total_orders,
          AVG(total) as avg_order_value
        FROM orders 
        WHERE user_id = ? AND payment_status = 'paid'
      `, [userId]);

      return result[0];
    } catch (error) {
      logger.error(`Error in getCustomerLifetimeValue query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search orders
   */
  async searchOrders(searchTerm, page = 1, limit = 10) {
    const pool = getPool();
    const offset = (page - 1) * limit;

    try {
      const searchPattern = `%${searchTerm}%`;
      
      const [orders] = await pool.query(`
        SELECT * FROM orders 
        WHERE order_number LIKE ? 
        OR user_id LIKE ? 
        OR notes LIKE ?
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `, [searchPattern, searchPattern, searchPattern, limit, offset]);

      const [countResult] = await pool.query(`
        SELECT COUNT(*) as total FROM orders 
        WHERE order_number LIKE ? 
        OR user_id LIKE ? 
        OR notes LIKE ?
      `, [searchPattern, searchPattern, searchPattern]);

      // Get items for each order
      for (const order of orders) {
        const [items] = await pool.query(
          'SELECT * FROM order_items WHERE order_id = ?',
          [order.id]
        );
        order.items = items;
        
        // Parse JSON fields
        try {
          order.shippingAddress = typeof order.shipping_address === 'string'
            ? JSON.parse(order.shipping_address)
            : order.shipping_address;

          order.billingAddress = typeof order.billing_address === 'string'
            ? JSON.parse(order.billing_address)
            : order.billing_address;
        } catch (err) {
          logger.warn(`Failed to parse address JSON for order ${order.id}: ${err.message}`);
          order.shippingAddress = order.shipping_address;
          order.billingAddress = order.billing_address;
        }
      }

      return {
        orders,
        pagination: {
          page,
          limit,
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error in searchOrders query: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new OrderQueries();