const orderService = require('../services/orderService');
const logger = require('../utils/logger');

// Create order
exports.createOrder = async (req, res, next) => {
  try {
    const orderData = {
      ...req.body,
      userId: req.user.id
    };

    const order = await orderService.createOrder(orderData);

    logger.info(`Order created for user: ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// Get order by ID
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns the order or is admin
    if (order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// Get user orders
exports.getUserOrders = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Check if user is accessing their own orders or is admin
    if (userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these orders'
      });
    }

    const result = await orderService.getUserOrders(
      userId,
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Update order status
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const order = await orderService.updateOrderStatus(orderId, status);

    logger.info(`Order ${orderId} status updated to ${status}`);

    res.status(200).json({
      success: true,
      message: 'Order status updated',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// Cancel order
exports.cancelOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await orderService.getOrderById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns the order
    if (order.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order'
      });
    }

    const updatedOrder = await orderService.cancelOrder(orderId);

    logger.info(`Order ${orderId} cancelled`);

    res.status(200).json({
      success: true,
      message: 'Order cancelled',
      data: updatedOrder
    });
  } catch (error) {
    next(error);
  }
};