/**
 * Order Model
 * 
 * Since we're using MySQL for orders, this file contains
 * the table schema definition and helper methods
 */

const { getPool } = require('../config/database');
const logger = require('../utils/logger');

class Order {
  /**
   * Order status enum
   */
  static STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled'
  };

  /**
   * Payment status enum
   */
  static PAYMENT_STATUS = {
    PENDING: 'pending',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded'
  };

  /**
   * Validate order status
   */
  static isValidStatus(status) {
    return Object.values(this.STATUS).includes(status);
  }

  /**
   * Validate payment status
   */
  static isValidPaymentStatus(status) {
    return Object.values(this.PAYMENT_STATUS).includes(status);
  }

  /**
   * Get order table schema
   */
  static getTableSchema() {
    return `
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        quote_id VARCHAR(255) NOT NULL,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        status ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
        subtotal DECIMAL(10, 2) NOT NULL,
        discount DECIMAL(10, 2) DEFAULT 0,
        shipping_cost DECIMAL(10, 2) DEFAULT 0,
        tax DECIMAL(10, 2) DEFAULT 0,
        total DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(50),
        payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
        shipping_address JSON,
        billing_address JSON,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_order_number (order_number),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
  }

  /**
   * Get order items table schema
   */
  static getOrderItemsTableSchema() {
    return `
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        sku VARCHAR(100),
        price DECIMAL(10, 2) NOT NULL,
        quantity INT NOT NULL,
        subtotal DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        INDEX idx_order_id (order_id),
        INDEX idx_product_id (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
  }

  /**
   * Calculate order totals
   */
  static calculateTotals(items, discount = 0, shippingCost = 0, taxRate = 0.08) {
    const subtotal = items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);

    const tax = subtotal * taxRate;
    const total = subtotal - discount + shippingCost + tax;

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      discount: parseFloat(discount.toFixed(2)),
      shippingCost: parseFloat(shippingCost.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    };
  }

  /**
   * Validate order data
   */
  static validateOrderData(orderData) {
    const errors = [];

    // Validate items
    if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      errors.push('Order must have at least one item');
    }

    // Validate each item
    if (orderData.items) {
      orderData.items.forEach((item, index) => {
        if (!item.productId) errors.push(`Item ${index + 1}: Product ID is required`);
        if (!item.name) errors.push(`Item ${index + 1}: Product name is required`);
        if (!item.price || item.price <= 0) errors.push(`Item ${index + 1}: Valid price is required`);
        if (!item.quantity || item.quantity <= 0) errors.push(`Item ${index + 1}: Valid quantity is required`);
      });
    }

    // Validate shipping address
    if (!orderData.shippingAddress) {
      errors.push('Shipping address is required');
    } else {
      const addr = orderData.shippingAddress;
      if (!addr.street) errors.push('Shipping address: Street is required');
      if (!addr.city) errors.push('Shipping address: City is required');
      if (!addr.state) errors.push('Shipping address: State is required');
      if (!addr.zipCode) errors.push('Shipping address: Zip code is required');
      if (!addr.country) errors.push('Shipping address: Country is required');
    }

    // Validate payment method
    if (!orderData.paymentMethod) {
      errors.push('Payment method is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Format order for response
   */
  static formatOrder(order) {
    if (!order) return null;

    // Parse JSON fields if they're strings
    if (typeof order.shipping_address === 'string') {
      order.shippingAddress = JSON.parse(order.shipping_address);
    }
    if (typeof order.billing_address === 'string') {
      order.billingAddress = JSON.parse(order.billing_address);
    }

    // Remove old snake_case fields
    delete order.shipping_address;
    delete order.billing_address;
    delete order.user_id;
    delete order.order_number;
    delete order.payment_method;
    delete order.payment_status;
    delete order.shipping_cost;
    delete order.created_at;
    delete order.updated_at;

    // Convert to camelCase
    return {
      id: order.id,
      userId: order.userId || order.user_id,
      quoteId: order.quoteId || order.quote_id,
      orderNumber: order.orderNumber || order.order_number,
      status: order.status,
      subtotal: parseFloat(order.subtotal),
      discount: parseFloat(order.discount),
      shippingCost: parseFloat(order.shippingCost || order.shipping_cost),
      tax: parseFloat(order.tax),
      total: parseFloat(order.total),
      paymentMethod: order.paymentMethod || order.payment_method,
      paymentStatus: order.paymentStatus || order.payment_status,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      notes: order.notes,
      items: order.items || [],
      createdAt: order.createdAt || order.created_at,
      updatedAt: order.updatedAt || order.updated_at
    };
  }

  /**
   * Can order be cancelled?
   */
  static canBeCancelled(status) {
    return [this.STATUS.PENDING, this.STATUS.CONFIRMED].includes(status);
  }

  /**
   * Can order be modified?
   */
  static canBeModified(status) {
    return status === this.STATUS.PENDING;
  }

  /**
   * Get next valid statuses
   */
  static getNextValidStatuses(currentStatus) {
    const statusFlow = {
      [this.STATUS.PENDING]: [this.STATUS.CONFIRMED, this.STATUS.CANCELLED],
      [this.STATUS.CONFIRMED]: [this.STATUS.PROCESSING, this.STATUS.CANCELLED],
      [this.STATUS.PROCESSING]: [this.STATUS.SHIPPED, this.STATUS.CANCELLED],
      [this.STATUS.SHIPPED]: [this.STATUS.DELIVERED],
      [this.STATUS.DELIVERED]: [],
      [this.STATUS.CANCELLED]: []
    };

    return statusFlow[currentStatus] || [];
  }
}

module.exports = Order;