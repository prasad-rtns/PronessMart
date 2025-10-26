const Cart = require('../models/Cart');
const logger = require('../utils/logger');

/**
 * Cart Data Access Layer
 * All database queries related to Cart model
 */

class CartQueries {
  /**
   * Find cart by user ID
   */
  async findByUserId(userId) {
    try {
      return await Cart.findOne({ userId });
    } catch (error) {
      logger.error(`Error in findByUserId query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create new cart
   */
  async create(userId) {
    try {
      return await Cart.create({
        userId,
        items: [],
        subtotal: 0,
        discount: 0,
        total: 0
      });
    } catch (error) {
      logger.error(`Error in create query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update cart
   */
  async update(userId, cartData) {
    try {
      return await Cart.findOneAndUpdate(
        { userId },
        { $set: cartData },
        { new: true, upsert: true }
      );
    } catch (error) {
      logger.error(`Error in update query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add item to cart
   */
  async addItem(userId, item) {
    try {
      let cart = await Cart.findOne({ userId });

      if (!cart) {
        cart = await this.create(userId);
      }

      // Check if item already exists
      const existingItemIndex = cart.items.findIndex(
        i => i.productId === item.productId
      );

      if (existingItemIndex > -1) {
        // Update quantity if item exists
        cart.items[existingItemIndex].quantity += item.quantity || 1;
      } else {
        // Add new item
        cart.items.push(item);
      }

      return await cart.save();
    } catch (error) {
      logger.error(`Error in addItem query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update item quantity in cart
   */
  async updateItemQuantity(userId, productId, quantity) {
    try {
      const cart = await Cart.findOne({ userId });

      if (!cart) {
        throw new Error('Cart not found');
      }

      const item = cart.items.find(i => i.productId === productId);

      if (!item) {
        throw new Error('Item not found in cart');
      }

      if (quantity <= 0) {
        // Remove item if quantity is 0 or negative
        cart.items = cart.items.filter(i => i.productId !== productId);
      } else {
        item.quantity = quantity;
      }

      return await cart.save();
    } catch (error) {
      logger.error(`Error in updateItemQuantity query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove item from cart
   */
  async removeItem(userId, productId) {
    try {
      const cart = await Cart.findOne({ userId });

      if (!cart) {
        throw new Error('Cart not found');
      }

      cart.items = cart.items.filter(i => i.productId !== productId);
      
      return await cart.save();
    } catch (error) {
      logger.error(`Error in removeItem query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear cart
   */
  async clearCart(userId) {
    try {
      return await Cart.findOneAndUpdate(
        { userId },
        {
          $set: {
            items: [],
            subtotal: 0,
            discount: 0,
            total: 0,
            couponCode: null
          }
        },
        { new: true }
      );
    } catch (error) {
      logger.error(`Error in clearCart query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete cart by user ID
   */
  async deleteByUserId(userId) {
    try {
      return await Cart.findOneAndDelete({ userId });
    } catch (error) {
      logger.error(`Error in deleteByUserId query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Apply coupon to cart
   */
  async applyCoupon(userId, couponCode, discount) {
    try {
      return await Cart.findOneAndUpdate(
        { userId },
        {
          $set: {
            couponCode,
            discount
          }
        },
        { new: true }
      );
    } catch (error) {
      logger.error(`Error in applyCoupon query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove coupon from cart
   */
  async removeCoupon(userId) {
    try {
      return await Cart.findOneAndUpdate(
        { userId },
        {
          $set: {
            couponCode: null,
            discount: 0
          }
        },
        { new: true }
      );
    } catch (error) {
      logger.error(`Error in removeCoupon query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get cart item count
   */
  async getItemCount(userId) {
    try {
      const cart = await Cart.findOne({ userId });
      
      if (!cart) {
        return 0;
      }

      return cart.items.reduce((total, item) => total + item.quantity, 0);
    } catch (error) {
      logger.error(`Error in getItemCount query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if product exists in cart
   */
  async hasProduct(userId, productId) {
    try {
      const cart = await Cart.findOne({ 
        userId,
        'items.productId': productId 
      });

      return !!cart;
    } catch (error) {
      logger.error(`Error in hasProduct query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get abandoned carts
   */
  async getAbandonedCarts(hours = 24) {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hours);

      return await Cart.find({
        'items.0': { $exists: true }, // Has at least one item
        lastModified: { $lt: cutoffTime }
      });
    } catch (error) {
      logger.error(`Error in getAbandonedCarts query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get carts by product
   */
  async getCartsByProduct(productId) {
    try {
      return await Cart.find({
        'items.productId': productId
      });
    } catch (error) {
      logger.error(`Error in getCartsByProduct query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update multiple cart items' prices (for price changes)
   */
  async updateProductPrice(productId, newPrice) {
    try {
      return await Cart.updateMany(
        { 'items.productId': productId },
        { $set: { 'items.$.price': newPrice } }
      );
    } catch (error) {
      logger.error(`Error in updateProductPrice query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get cart statistics
   */
  async getCartStats() {
    try {
      const totalCarts = await Cart.countDocuments();
      const activeCarts = await Cart.countDocuments({
        'items.0': { $exists: true }
      });
      const emptyCarts = totalCarts - activeCarts;

      const avgItemsPerCart = await Cart.aggregate([
        {
          $project: {
            itemCount: { $size: '$items' }
          }
        },
        {
          $group: {
            _id: null,
            avgItems: { $avg: '$itemCount' }
          }
        }
      ]);

      return {
        totalCarts,
        activeCarts,
        emptyCarts,
        avgItemsPerCart: avgItemsPerCart.length > 0 
          ? Math.round(avgItemsPerCart[0].avgItems * 10) / 10 
          : 0
      };
    } catch (error) {
      logger.error(`Error in getCartStats query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Merge guest cart with user cart
   */
  async mergeCarts(guestCartId, userCartId) {
    try {
      const guestCart = await Cart.findById(guestCartId);
      const userCart = await Cart.findById(userCartId);

      if (!guestCart || !userCart) {
        throw new Error('Cart not found');
      }

      // Merge items
      guestCart.items.forEach(guestItem => {
        const existingItem = userCart.items.find(
          item => item.productId === guestItem.productId
        );

        if (existingItem) {
          existingItem.quantity += guestItem.quantity;
        } else {
          userCart.items.push(guestItem);
        }
      });

      // Delete guest cart
      await Cart.findByIdAndDelete(guestCartId);

      // Save merged cart
      return await userCart.save();
    } catch (error) {
      logger.error(`Error in mergeCarts query: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new CartQueries();