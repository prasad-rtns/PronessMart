const cartService = require('../services/cartService');
const logger = require('../utils/logger');

// Get user's cart
exports.getCart = async (req, res, next) => {
  try {
    const cart = await cartService.getCart(req.params.userId);

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    next(error);
  }
};

// Add item to cart
exports.addItem = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const item = req.body;

    // Validate user can only modify their own cart
    if (req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this cart'
      });
    }

    const cart = await cartService.addItem(userId, item);

    logger.info(`Item added to cart for user: ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: cart
    });
  } catch (error) {
    next(error);
  }
};

// Update cart item
exports.updateItem = async (req, res, next) => {
  try {
    const { userId, itemId } = req.params;
    const { quantity } = req.body;

    // Validate user can only modify their own cart
    if (req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this cart'
      });
    }

    const cart = await cartService.updateItem(userId, itemId, quantity);

    logger.info(`Cart item updated for user: ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Cart item updated',
      data: cart
    });
  } catch (error) {
    next(error);
  }
};

// Remove item from cart
exports.removeItem = async (req, res, next) => {
  try {
    const { userId, itemId } = req.params;

    // Validate user can only modify their own cart
    if (req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this cart'
      });
    }

    const cart = await cartService.removeItem(userId, itemId);

    logger.info(`Item removed from cart for user: ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: cart
    });
  } catch (error) {
    next(error);
  }
};

// Clear cart
exports.clearCart = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Validate user can only modify their own cart
    if (req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this cart'
      });
    }

    const cart = await cartService.clearCart(userId);

    logger.info(`Cart cleared for user: ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Cart cleared',
      data: cart
    });
  } catch (error) {
    next(error);
  }
};