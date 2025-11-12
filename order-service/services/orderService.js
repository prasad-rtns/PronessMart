const orderQueries = require('../data/orderQueries');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const kafkaProducer = require('./kafkaProducer');
const { serviceClient } = require('../helpers/serviceClient');

// Service URLs and names from environment
const CART_SERVICE_URL = process.env.CART_SERVICE_URL || 'http://cart-service:3003';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';

const CART_SERVICE_NAME = 'cart-service';
const PRODUCT_SERVICE_NAME = 'product-service';
const USER_SERVICE_NAME = 'user-service';

class OrderService {
  generateOrderNumber() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  /**
   * Create order with cart and inventory integration
   */
  async createOrder(orderData) {
    const orderId = uuidv4();
    const orderNumber = this.generateOrderNumber();

    try {
      logger.info(`Creating order ${orderNumber} for user ${orderData.userId}`);

      // Step 1: Validate cart and get items (with circuit breaker)
      const cartItems = await this.validateAndGetCart(orderData.userId, orderData.cartId, orderData.token);
      
      if (!cartItems || cartItems.length === 0) {
        throw new Error('Cart is empty or not found');
      }

      // Step 2: Check product availability and stock (with circuit breaker)
      await this.validateProductAvailability(cartItems);

      // Step 3: Calculate totals
      const subtotal = cartItems.reduce((sum, item) => sum + (item.priceAtAdd * item.quantity), 0);
      const discount = orderData.discount || 0;
      const shippingCost = orderData.shippingCost || 0;
      const tax = subtotal * 0.08; // 8% tax
      const total = subtotal - discount + shippingCost + tax;

      // Step 4: Prepare order data
      const order = {
        id: orderId,
        userId: orderData.userId,
        cartId: orderData.quoteId,
        orderNumber,
        status: 'pending',
        subtotal,
        discount,
        shippingCost,
        tax,
        total,
        paymentMethod: orderData.paymentMethod,
        paymentStatus: 'pending',
        shippingAddress: orderData.shippingAddress,
        billingAddress: orderData.billingAddress,
        notes: orderData.notes
      };

      // Step 5: Prepare order items
      const orderItems = cartItems.map(item => ({
        productId: item.product,
        productName: item.productDetails?.name || 'Unknown Product',
        sku: item.productDetails?.sku || '',
        price: item.priceAtAdd,
        quantity: item.quantity,
        subtotal: item.priceAtAdd * item.quantity
      }));

      // Step 6: Create order with items in transaction
      await orderQueries.createOrderWithItems(order, orderItems);

      logger.info(`Order created successfully: ${orderNumber} (${orderId})`);

      // Step 7: Publish Kafka events (async, non-blocking)
      this.publishOrderEvents(orderId, orderNumber, orderData.userId, total, orderItems, cartItems)
        .catch(error => {
          logger.error(`Error publishing Kafka events for order ${orderId}: ${error.message}`);
        });

      // Return created order
      return await this.getOrderById(orderId);
    } catch (error) {
      logger.error(`Error creating order ${orderNumber}: ${error.message}`, { 
        orderId,
        userId: orderData.userId,
        error: error.stack 
      });
      
      // Enhance error with circuit breaker info if available
      if (error.circuitBreakerState) {
        error.message = `${error.message} (Circuit: ${error.circuitBreakerState.state})`;
      }
      
      throw error;
    }
  }

  /**
   * Publish all Kafka events for order creation
   */
  async publishOrderEvents(orderId, orderNumber, userId, total, orderItems, cartItems) {
    try {
      logger.info(`[Kafka] Publishing events for order ${orderId}`);

      // Event 1: Order Created
      await kafkaProducer.publishOrderEvent('order.created', {
        orderId,
        orderNumber,
        userId,
        total,
        items: orderItems,
        timestamp: new Date().toISOString()
      });

      // Event 2: Inventory Update
      await kafkaProducer.publishOrderEvent('inventory.update', {
        orderId,
        orderNumber,
        userId,
        action: 'decrement',
        items: orderItems.map(item => ({
          productId: item.productId,
          sku: item.sku,
          quantity: item.quantity,
          operation: 'subtract'
        })),
        timestamp: new Date().toISOString()
      });

      // Event 3: Cart Clear
      await kafkaProducer.publishOrderEvent('cart.clear', {
        orderId,
        orderNumber,
        userId,
        reason: 'order_created',
        timestamp: new Date().toISOString()
      });

      // Event 4: Order Analytics
      await kafkaProducer.publishOrderEvent('order.analytics', {
        orderId,
        orderNumber,
        userId,
        total,
        itemCount: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        productIds: orderItems.map(item => item.productId),
        timestamp: new Date().toISOString()
      });

      logger.info(`[Kafka] All events published successfully for order ${orderId}`);
    } catch (error) {
      logger.error(`[Kafka] Error publishing events for order ${orderId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate cart and get items using serviceClient
   */
  async validateAndGetCart(userId, cartId, token) {
    try {
      logger.info(`Validating cart for user: ${userId}`);

      // Use serviceClient with circuit breaker
      const response = await serviceClient.get(
        CART_SERVICE_NAME,
        `${CART_SERVICE_URL}/api/v1/cart`,
        {
          headers: { 
            'Authorization': `Bearer ${token}` 
          }
        }
      );

      if (!response.data || !response.data.success) {
        throw new Error('Failed to fetch cart');
      }

      const cart = response.data.data;

      if (!cart || !cart.items || cart.items.length === 0) {
        throw new Error('Cart is empty');
      }

      if (cart.status !== 'active') {
        throw new Error(`Cart status is ${cart.status}, expected active`);
      }

      logger.info(`Cart validated successfully with ${cart.items.length} items`);
      return cart.items;
    } catch (error) {
      if (error.code === 'CIRCUIT_OPEN') {
        logger.error(`Cart service circuit breaker is OPEN: ${error.message}`);
        throw new Error('Cart service is temporarily unavailable. Please try again later.');
      }

      if (error.response) {
        logger.error(`Cart service error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        throw new Error(`Cart validation failed: ${error.response.data?.message || 'Unknown error'}`);
      }

      logger.error(`Error validating cart: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate product availability using serviceClient
   */
  async validateProductAvailability(cartItems) {
    try {
      logger.info(`Validating availability for ${cartItems.length} products`);

      const validationPromises = cartItems.map(async (item) => {
        try {
          // Use serviceClient with circuit breaker
          const response = await serviceClient.get(
            PRODUCT_SERVICE_NAME,
            `${PRODUCT_SERVICE_URL}/api/v1/products/${item.product}`
          );

          if (!response.data || !response.data.success) {
            return {
              productId: item.product,
              valid: false,
              error: 'Product not found'
            };
          }

          const product = response.data.data;

          // Check availability
          if (product.availability !== 'in_stock') {
            return {
              productId: item.product,
              valid: false,
              error: `Product is ${product.availability}`
            };
          }

          // Check stock
          if (product.stock < item.quantity) {
            return {
              productId: item.product,
              valid: false,
              error: `Insufficient stock. Available: ${product.stock}, Requested: ${item.quantity}`
            };
          }

          return {
            productId: item.product,
            valid: true,
            product: product
          };
        } catch (error) {
          if (error.code === 'CIRCUIT_OPEN') {
            logger.error(`Product service circuit breaker is OPEN for product ${item.product}`);
            return {
              productId: item.product,
              valid: false,
              error: 'Product service temporarily unavailable'
            };
          }

          logger.error(`Error validating product ${item.product}: ${error.message}`);
          return {
            productId: item.product,
            valid: false,
            error: `Failed to validate product: ${error.message}`
          };
        }
      });

      const validations = await Promise.all(validationPromises);
      const invalidProducts = validations.filter(v => !v.valid);

      if (invalidProducts.length > 0) {
        const errorMessage = invalidProducts
          .map(p => `Product ${p.productId}: ${p.error}`)
          .join(', ');
        throw new Error(`Product validation failed: ${errorMessage}`);
      }

      logger.info('All products validated successfully');
      return validations;
    } catch (error) {
      logger.error(`Product validation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update order status with inventory restoration for cancellations
   */
  async updateOrderStatus(orderId, status, userId) {
    try {
      logger.info(`Updating order ${orderId} status to ${status}`);

      const result = await orderQueries.updateOrderStatus(orderId, status, userId);

      if (!result.success) {
        throw new Error('Failed to update order status');
      }

      const order = result.order;

      // Publish status update event
      await kafkaProducer.publishOrderEvent('order.status.updated', {
        orderId,
        orderNumber: order.order_number,
        userId,
        oldStatus: result.oldStatus,
        newStatus: status,
        timestamp: new Date().toISOString()
      });

      // Handle cancellation
      if (status === 'cancelled') {
        await this.handleOrderCancellation(orderId, order);
      }

      logger.info(`Order ${orderId} status updated from ${result.oldStatus} to ${status}`);

      return await this.getOrderById(orderId);
    } catch (error) {
      logger.error(`Error updating order status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle order cancellation - restore inventory
   */
  async handleOrderCancellation(orderId, order) {
    try {
      logger.info(`Handling cancellation for order ${orderId}`);

      const orderItems = await orderQueries.getOrderItems(orderId);

      if (!orderItems || orderItems.length === 0) {
        logger.warn(`No items found for order ${orderId}`);
        return;
      }

      // Publish inventory restoration event
      await kafkaProducer.publishOrderEvent('inventory.restore', {
        orderId,
        orderNumber: order.order_number || order.orderNumber,
        userId: order.user_id || order.userId,
        action: 'increment',
        items: orderItems.map(item => ({
          productId: item.product_id || item.productId,
          sku: item.sku,
          quantity: item.quantity,
          operation: 'add'
        })),
        reason: 'order_cancelled',
        timestamp: new Date().toISOString()
      });

      // Publish order cancelled event
      await kafkaProducer.publishOrderEvent('order.cancelled', {
        orderId,
        orderNumber: order.order_number || order.orderNumber,
        userId: order.user_id || order.userId,
        total: order.total,
        items: orderItems,
        timestamp: new Date().toISOString()
      });

      logger.info(`Inventory restoration event published for order ${orderId}`);
    } catch (error) {
      logger.error(`Error handling order cancellation: ${error.message}`);
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(orderId, paymentStatus, userId) {
    try {
      logger.info(`Updating payment status for order ${orderId} to ${paymentStatus}`);

      const result = await orderQueries.updateOrderPaymentStatus(orderId, paymentStatus, userId);

      if (!result.success) {
        throw new Error('Failed to update payment status');
      }

      const order = result.order;

      // Publish payment event
      await kafkaProducer.publishOrderEvent('order.payment.updated', {
        orderId,
        orderNumber: order.order_number,
        userId,
        oldPaymentStatus: result.oldPaymentStatus,
        newPaymentStatus: paymentStatus,
        timestamp: new Date().toISOString()
      });

      logger.info(`Order ${orderId} payment status updated to ${paymentStatus}`);

      return await this.getOrderById(orderId);
    } catch (error) {
      logger.error(`Error updating payment status: ${error.message}`);
      throw error;
    }
  }

  async cancelOrder(orderId, userId) {
    return await this.updateOrderStatus(orderId, 'cancelled', userId);
  }

  async getOrderById(orderId) {
    try {
      return await orderQueries.findById(orderId);
    } catch (error) {
      logger.error(`Error getting order: ${error.message}`);
      throw error;
    }
  }

  async getUserOrders(userId, page = 1, limit = 10) {
    try {
      return await orderQueries.findByUserId(userId, page, limit);
    } catch (error) {
      logger.error(`Error getting user orders: ${error.message}`);
      throw error;
    }
  }

  async getOrderByNumber(orderNumber) {
    try {
      return await orderQueries.findByOrderNumber(orderNumber);
    } catch (error) {
      logger.error(`Error getting order by number: ${error.message}`);
      throw error;
    }
  }

  async getOrdersByStatus(status, page = 1, limit = 10) {
    try {
      return await orderQueries.findByStatus(status, page, limit);
    } catch (error) {
      logger.error(`Error getting orders by status: ${error.message}`);
      throw error;
    }
  }

  async searchOrders(searchTerm, page = 1, limit = 10) {
    try {
      return await orderQueries.searchOrders(searchTerm, page, limit);
    } catch (error) {
      logger.error(`Error searching orders: ${error.message}`);
      throw error;
    }
  }

  async getOrderStats() {
    try {
      return await orderQueries.getOrderStats();
    } catch (error) {
      logger.error(`Error getting order stats: ${error.message}`);
      throw error;
    }
  }

  async deleteOrder(orderId) {
    try {
      return await orderQueries.deleteById(orderId);
    } catch (error) {
      logger.error(`Error deleting order: ${error.message}`);
      throw error;
    }
  }

  /**
   * Health check for service dependencies
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {},
      circuitBreakers: serviceClient.getCircuitBreakerStates()
    };

    // Check each service
    const checks = [
      serviceClient.healthCheck(PRODUCT_SERVICE_NAME, `${PRODUCT_SERVICE_URL}/health`),
      serviceClient.healthCheck(CART_SERVICE_NAME, `${CART_SERVICE_URL}/health`),
      serviceClient.healthCheck(USER_SERVICE_NAME, `${USER_SERVICE_URL}/health`)
    ];

    const results = await Promise.allSettled(checks);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const serviceName = [PRODUCT_SERVICE_NAME, CART_SERVICE_NAME, USER_SERVICE_NAME][index];
        health.services[serviceName] = result.value;
        
        if (result.value.status !== 'healthy') {
          health.status = 'degraded';
        }
      }
    });

    return health;
  }
}

module.exports = new OrderService();