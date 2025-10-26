const cartQueries = require('../data/cartQueries');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

const CART_CACHE_TTL = 3600; // 1 hour

class CartService {
  async getCart(userId) {
    try {
      // Try to get from Redis cache first
      const redis = getRedisClient();
      const cachedCart = await redis.get(`cart:${userId}`);

      if (cachedCart) {
        logger.info(`Cart retrieved from cache for user: ${userId}`);
        return JSON.parse(cachedCart);
      }

      // If not in cache, get from database
      let cart = await cartQueries.findByUserId(userId);

      if (!cart) {
        cart = await cartQueries.create(userId);
      }

      // Cache the cart
      await redis.setEx(`cart:${userId}`, CART_CACHE_TTL, JSON.stringify(cart));

      return cart;
    } catch (error) {
      logger.error(`Error getting cart: ${error.message}`);
      throw error;
    }
  }

  async addItem(userId, item) {
    try {
      const cart = await cartQueries.addItem(userId, item);

      // Update cache
      const redis = getRedisClient();
      await redis.setEx(`cart:${userId}`, CART_CACHE_TTL, JSON.stringify(cart));

      return cart;
    } catch (error) {
      logger.error(`Error adding item to cart: ${error.message}`);
      throw error;
    }
  }

  async updateItem(userId, itemId, quantity) {
    try {
      const cart = await cartQueries.updateItemQuantity(userId, itemId, quantity);

      // Update cache
      const redis = getRedisClient();
      await redis.setEx(`cart:${userId}`, CART_CACHE_TTL, JSON.stringify(cart));

      return cart;
    } catch (error) {
      logger.error(`Error updating cart item: ${error.message}`);
      throw error;
    }
  }

  async removeItem(userId, itemId) {
    try {
      const cart = await cartQueries.removeItem(userId, itemId);

      // Update cache
      const redis = getRedisClient();
      await redis.setEx(`cart:${userId}`, CART_CACHE_TTL, JSON.stringify(cart));

      return cart;
    } catch (error) {
      logger.error(`Error removing item from cart: ${error.message}`);
      throw error;
    }
  }

  async clearCart(userId) {
    try {
      const cart = await cartQueries.clearCart(userId);

      // Clear cache
      const redis = getRedisClient();
      await redis.del(`cart:${userId}`);

      return cart;
    } catch (error) {
      logger.error(`Error clearing cart: ${error.message}`);
      throw error;
    }
  }

  async applyCoupon(userId, couponCode) {
    try {
      const cart = await cartQueries.findByUserId(userId);

      if (!cart) {
        throw new Error('Cart not found');
      }

      // Simulate coupon validation (in real app, call coupon service)
      const discount = cart.subtotal * 0.1; // 10% discount

      const updatedCart = await cartQueries.applyCoupon(userId, couponCode, discount);

      // Update cache
      const redis = getRedisClient();
      await redis.setEx(`cart:${userId}`, CART_CACHE_TTL, JSON.stringify(updatedCart));

      return updatedCart;
    } catch (error) {
      logger.error(`Error applying coupon: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new CartService();