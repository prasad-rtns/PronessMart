const { getPool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Order Data Access Layer
 * All database queries related to Order model (MySQL)
 */

class OrderQueries {
  /**
   * Create new order
   */
  async create(orderData) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const insertOrderQuery = `
        INSERT INTO orders (
          id, user_id,quote_id, order_number, status, subtotal, discount, 
          shipping_cost, tax, total, payment_method, payment_status,
          shipping_address, billing_address, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await connection.query(insertOrderQuery, [
        orderData.id,
        orderData.userId,
        orderData.quoteId,
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

      await connection.commit();
      return orderData.id;
    } catch (error) {
      await connection.rollback();
      logger.error(`Error in create query: ${error.message}`);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Insert order items
   */
  async insertOrderItems(orderId, items) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      const insertItemQuery = `
        INSERT INTO order_items (order_id, product_id, product_name, sku, price, quantity, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      for (const item of items) {
        await connection.query(insertItemQuery, [
          orderId,
          item.productId,
          item.name,
          item.sku,
          item.price,
          item.quantity,
          item.price * item.quantity
        ]);
      }

      return true;
    } catch (error) {
      logger.error(`Error in insertOrderItems query: ${error.message}`);
      throw error;
    } finally {
      connection.release();
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
   * Update order status
   */
  async updateStatus(orderId, status) {
    const pool = getPool();

    try {
      const [result] = await pool.query(
        'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
        [status, orderId]
      );

      return result.affectedRows > 0;
    } catch (error) {
      logger.error(`Error in updateStatus query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(orderId, paymentStatus) {
    const pool = getPool();

    try {
      const [result] = await pool.query(
        'UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?',
        [paymentStatus, orderId]
      );

      return result.affectedRows > 0;
    } catch (error) {
      logger.error(`Error in updatePaymentStatus query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update order
   */
  async update(orderId, updateData) {
    const pool = getPool();

    try {
      const fields = [];
      const values = [];

      Object.keys(updateData).forEach(key => {
        if (key !== 'id') {
          fields.push(`${key} = ?`);
          values.push(updateData[key]);
        }
      });

      fields.push('updated_at = NOW()');
      values.push(orderId);

      const query = `UPDATE orders SET ${fields.join(', ')} WHERE id = ?`;
      const [result] = await pool.query(query, values);

      return result.affectedRows > 0;
    } catch (error) {
      logger.error(`Error in update query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete order
   */
  async deleteById(orderId) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Delete order items first (foreign key constraint)
      await connection.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);

      // Delete order
      await connection.query('DELETE FROM orders WHERE id = ?', [orderId]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      logger.error(`Error in deleteById query: ${error.message}`);
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