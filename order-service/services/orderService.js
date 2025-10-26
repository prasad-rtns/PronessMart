const orderQueries = require('../data/orderQueries');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const kafkaProducer = require('./kafkaProducer');

class OrderService {
  generateOrderNumber() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  async createOrder(orderData) {
    try {
      const orderId = uuidv4();
      const orderNumber = this.generateOrderNumber();

      // Calculate totals
      const subtotal = orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const discount = orderData.discount || 0;
      const shippingCost = orderData.shippingCost || 0;
      const tax = subtotal * 0.08; // 8% tax
      const total = subtotal - discount + shippingCost + tax;

      // Prepare order data
      const order = {
        id: orderId,
        userId: orderData.userId,
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

      // Create order
      await orderQueries.create(order);

      // Insert order items
      await orderQueries.insertOrderItems(orderId, orderData.items);

      // Publish order created event to Kafka
      await kafkaProducer.publishOrderEvent('order.created', {
        orderId,
        orderNumber,
        userId: orderData.userId,
        total,
        items: orderData.items
      });

      logger.info(`Order created: ${orderNumber}`);

      return await this.getOrderById(orderId);
    } catch (error) {
      logger.error(`Error creating order: ${error.message}`);
      throw error;
    }
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

  async updateOrderStatus(orderId, status) {
    try {
      const updated = await orderQueries.updateStatus(orderId, status);

      if (!updated) {
        throw new Error('Order not found');
      }

      // Publish order status updated event
      await kafkaProducer.publishOrderEvent('order.status.updated', {
        orderId,
        status
      });

      logger.info(`Order ${orderId} status updated to ${status}`);

      return await this.getOrderById(orderId);
    } catch (error) {
      logger.error(`Error updating order status: ${error.message}`);
      throw error;
    }
  }

  async cancelOrder(orderId) {
    return await this.updateOrderStatus(orderId, 'cancelled');
  }
}

module.exports = new OrderService();