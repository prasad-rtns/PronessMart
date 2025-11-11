const cartService = require('../services/cartService');
const logger = require('../utils/logger');

class CartController {
  // Get All cart
async getAllCarts(req, res, next) {
  try {
    const { category, sku, name, search, page = 1, limit = 20, sort = '-createdAt' } = req.query;

    const filters = {};
    if (category) filters.category = category;
    if (sku) filters.sku = sku;
    if (name) filters.name = name;
    if (search) filters.$text = { $search: search };

    const carts = await cartService.getAllCarts(
      filters,
      parseInt(page),
      parseInt(limit),
      sort
    );

    res.status(200).json({
      success: true,
      data: carts
    });
  } catch (error) {
    next(error);
  }
};
  
  /**
   * Get user's cart
   */
  async getCart(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;
      const sessionId = req.headers['x-session-id'] || req.sessionID;
      const cart = await cartService.getCart(userId, sessionId);

      res.status(200).json({
        success: true,
        data: cart
      });
    } catch (error) {
      logger.error(`Error in getCart controller: ${error.message}`);
      next(error);
    }
  }

  /**
   * Get cart summary
   */
  async getCartSummary(req, res, next) {
    try {
      const summary = await cartService.getCartSummary(req.user.id);

      res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error(`Error in getCartSummary controller: ${error.message}`);
      next(error);
    }
  }

  /**
   * Add single item to cart
   */
  async addItem(req, res, next) {
    try {
      const { productId, quantity } = req.body;
      const userId = req.user ? req.user.id : null;
      // Always ensure a sessionId exists for guests
      const sessionId =
        req.headers['x-session-id'] ||  // if frontend provides one
        req.sessionID ||                 // if express-session is enabled
        `guest_${Date.now()}_${Math.floor(Math.random() * 1000)}`; // fallback generator
      if (!productId || !quantity) {
        return res.status(400).json({
          success: false,
          message: 'Product ID and quantity are required'
        });
      }

      if (quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be at least 1'
        });
      }

      const cart = await cartService.addItem(userId, productId, quantity, sessionId);

      res.status(200).json({
        success: true,
        message: 'Item added to cart',
        data: cart
      });
    } catch (error) {
      logger.error(`Error in addItem controller: ${error.message}`);
      
      if (error.message.includes('not found') || error.message.includes('not available')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      if (error.message.includes('stock') || error.message.includes('availability')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      next(error);
    }
  }

  /**
   * Add multiple items to cart
   */
  async addMultipleItems(req, res, next) {
    try {
      const { items } = req.body;
      const userId = req.user ? req.user.id : null;
      const sessionId =
        req.headers['x-session-id'] ||  // if frontend provides one
        req.sessionID ||                 // if express-session is enabled
        `guest_${Date.now()}_${Math.floor(Math.random() * 1000)}`; // fallback generator
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Items array is required and must not be empty'
        });
      }

      // Validate each item
      for (const item of items) {
        if (!item.productId || !item.quantity) {
          return res.status(400).json({
            success: false,
            message: 'Each item must have productId and quantity'
          });
        }

        if (item.quantity < 1) {
          return res.status(400).json({
            success: false,
            message: 'Quantity must be at least 1'
          });
        }
      }

      const result = await cartService.addMultipleItems(userId, items, sessionId);

      res.status(200).json({
        success: true,
        message: result.errors && result.errors.length > 0 
          ? 'Some items added to cart with errors' 
          : 'Items added to cart',
        data: result
      });
    } catch (error) {
      logger.error(`Error in addMultipleItems controller: ${error.message}`);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update item quantity
   */
  async updateItemQuantity(req, res, next) {
    try {
      const { productId } = req.params;
      const { quantity } = req.body;

      if (quantity === undefined || quantity === null) {
        return res.status(400).json({
          success: false,
          message: 'Quantity is required'
        });
      }

      if (quantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Quantity cannot be negative'
        });
      }

      const cart = await cartService.updateItemQuantity(req.user.id, productId, quantity);

      res.status(200).json({
        success: true,
        message: quantity === 0 ? 'Item removed from cart' : 'Item quantity updated',
        data: cart
      });
    } catch (error) {
      logger.error(`Error in updateItemQuantity controller: ${error.message}`);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      if (error.message.includes('stock')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      next(error);
    }
  }

  /**
   * Remove item from cart
   */
  async removeItem(req, res, next) {
    try {
      const { productId } = req.params;

      const cart = await cartService.removeItem(req.user.id, productId);

      res.status(200).json({
        success: true,
        message: 'Item removed from cart',
        data: cart
      });
    } catch (error) {
      logger.error(`Error in removeItem controller: ${error.message}`);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      next(error);
    }
  }

  /**
   * Remove multiple items from cart
   */
  async removeMultipleItems(req, res, next) {
    try {
      const { productIds } = req.body;

      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Product IDs array is required and must not be empty'
        });
      }

      const cart = await cartService.removeMultipleItems(req.user.id, productIds);

      res.status(200).json({
        success: true,
        message: 'Items removed from cart',
        data: cart
      });
    } catch (error) {
      logger.error(`Error in removeMultipleItems controller: ${error.message}`);
      next(error);
    }
  }

  /**
   * Clear cart
   */
  async clearCart(req, res, next) {
    try {
      const cart = await cartService.clearCart(req.user.id);

      res.status(200).json({
        success: true,
        message: 'Cart cleared successfully',
        data: cart
      });
    } catch (error) {
      logger.error(`Error in clearCart controller: ${error.message}`);
      next(error);
    }
  }

  /**
   * Apply coupon
   */
  async applyCoupon(req, res, next) {
    try {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Coupon code is required'
        });
      }

      const cart = await cartService.applyCoupon(req.user.id, code);

      res.status(200).json({
        success: true,
        message: 'Coupon applied successfully',
        data: cart
      });
    } catch (error) {
      logger.error(`Error in applyCoupon controller: ${error.message}`);
      
      if (error.message.includes('Invalid') || error.message.includes('expired')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      next(error);
    }
  }

  /**
   * Remove coupon
   */
  async removeCoupon(req, res, next) {
    try {
      const { code } = req.params;

      const cart = await cartService.removeCoupon(req.user.id, code);

      res.status(200).json({
        success: true,
        message: 'Coupon removed successfully',
        data: cart
      });
    } catch (error) {
      logger.error(`Error in removeCoupon controller: ${error.message}`);
      next(error);
    }
  }

  /**
   * Check cart availability
   */
  async checkAvailability(req, res, next) {
    try {
      const availability = await cartService.checkAvailability(req.user.id);

      res.status(200).json({
        success: true,
        data: availability
      });
    } catch (error) {
      logger.error(`Error in checkAvailability controller: ${error.message}`);
      next(error);
    }
  }

  /**
   * Sync cart with latest product data
   */
  async syncCart(req, res, next) {
    try {
      const cart = await cartService.syncCart(req.user.id);

      res.status(200).json({
        success: true,
        message: 'Cart synced successfully',
        data: cart
      });
    } catch (error) {
      logger.error(`Error in syncCart controller: ${error.message}`);
      next(error);
    }
  }

  /**
   * Merge guest cart with user cart
   */
  async mergeCarts(req, res, next) {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required'
        });
      }

      const cart = await cartService.mergeCarts(req.user.id, sessionId);

      res.status(200).json({
        success: true,
        message: 'Carts merged successfully',
        data: cart
      });
    } catch (error) {
      logger.error(`Error in mergeCarts controller: ${error.message}`);
      next(error);
    }
  }
}

module.exports = new CartController();