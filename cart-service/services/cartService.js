const cartQueries = require('../data/cartQueries');
const axios = require('axios');
const logger = require('../utils/logger');
const cache = require('../utils/cache');

const CACHE_TTL = 3600; // 1 hour cache TTL

// Product service URLs
const envUrl = process.env.PRODUCT_SERVICE_URL;
const DEFAULT_CONTAINER_URL = 'http://product-service:3002';
const DEFAULT_HOST_URL = 'http://127.0.0.1:3002';

const PRODUCT_SERVICE_URL = envUrl || DEFAULT_CONTAINER_URL || DEFAULT_HOST_URL;

// log for easy debugging on startup

class CartService {
  async getAllCarts(filters = {}, page = 1, limit = 20, sort = '-createdAt') {
    try {
      const cacheKey = `products:${JSON.stringify(filters)}:page=${page}:limit=${limit}:sort=${sort}`;
      logger.debug(`🧩 Checking Redis cache for key: ${cacheKey}`);

      // ✅ Try cache first
      let getAllCarts = await cache.getCache(cacheKey);
      if (getAllCarts && false) {
        logger.debug(`✅ Cache hit for key: ${cacheKey}`);
        return getAllCarts;
      }
      // 🚀 If not in cache, fetch from DB
      // 2️⃣ Fetch from DB
      // const dbResult = await cartQueries.findAll(filters, page, limit, sort);
      const dbResult = await cartQueries.getAllCarts(filters, page, limit, sort);
      const carts = dbResult?.carts || [];
      const pagination = dbResult?.pagination || {};

      logger.debug(`DB returned ${carts.length} products for filters ${JSON.stringify(filters)}`);

      // 3️⃣ Cache complete object (including pagination)
      if (dbResult && carts.length >= 0) {
        await cache.setCache(cacheKey, dbResult, CACHE_TTL);
        logger.debug(`💾 Cached ${carts.length} carts for key: ${cacheKey}`);
      }

      return dbResult;
      return await cartQueries.findAll(filters, page, limit, sort);
    } catch (error) {
      logger.error(`Error getting Carts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user's cart
   */
  async getCart(userId, sessionId = null) {
    try {
      return await cartQueries.findOrCreate(userId, sessionId);
    } catch (error) {
      logger.error(`Error in getCart service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add single item to cart
   */
  async addItem(userId, productId, quantity = 1, sessionId = null) {
    try {
      // Fetch product details from product service
      const productData = await this.fetchProductDetails(productId);

      if (!productData) {
        throw new Error('Product not found');
      }

      // Validate availability
      if (productData.availability !== 'in_stock') {
        throw new Error(`Product is ${productData.availability}`);
      }

      // Validate stock
      if (productData.stock < quantity) {
        throw new Error(`Insufficient stock. Available: ${productData.stock}`);
      }

      // Add item to cart
      const cart = await cartQueries.addItem(userId, productData, quantity);

      logger.info(`Item added to cart: userId=${userId}, productId=${productId}, quantity=${quantity}`);
      
      return cart;
    } catch (error) {
      logger.error(`Error in addItem service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add multiple items to cart
   */
  async addMultipleItems(userId, items, sessionId = null) {
    try {
      // Validate input
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Items array is required and must not be empty');
      }

      // Fetch all product details
      const productIds = items.map(item => item.productId);
      const productsData = await this.fetchMultipleProducts(productIds);

      if (productsData.length !== productIds.length) {
        throw new Error('One or more products not found');
      }

      // Prepare items with product data
      const itemsToAdd = [];
      const errors = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const productData = productsData[i];

        // Validate availability
        if (productData.availability !== 'in_stock') {
          errors.push({
            productId: item.productId,
            error: `Product is ${productData.availability}`
          });
          continue;
        }

        // Validate stock
        if (productData.stock < item.quantity) {
          errors.push({
            productId: item.productId,
            error: `Insufficient stock. Available: ${productData.stock}, Requested: ${item.quantity}`
          });
          continue;
        }

        itemsToAdd.push({
          productData,
          quantity: item.quantity
        });
      }

      // If all items have errors, throw error
      if (itemsToAdd.length === 0) {
        throw new Error('No valid items to add. ' + JSON.stringify(errors));
      }

      // Add items to cart
      const cart = await cartQueries.addMultipleItems(userId, itemsToAdd);

      logger.info(`Multiple items added to cart: userId=${userId}, itemsCount=${itemsToAdd.length}`);

      // Return cart with errors if any
      if (errors.length > 0) {
        return {
          cart,
          errors,
          message: 'Some items could not be added'
        };
      }

      return { cart };
    } catch (error) {
      logger.error(`Error in addMultipleItems service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update item quantity
   */
  async updateItemQuantity(userId, productId, quantity) {
    try {
      // If quantity is 0, remove the item
      if (quantity === 0) {
        return await this.removeItem(userId, productId);
      }

      // Fetch product to validate stock
      const productData = await this.fetchProductDetails(productId);

      if (!productData) {
        throw new Error('Product not found');
      }

      // Validate stock
      if (productData.stock < quantity) {
        throw new Error(`Insufficient stock. Available: ${productData.stock}`);
      }

      const cart = await cartQueries.updateItemQuantity(userId, productId, quantity);

      logger.info(`Cart item quantity updated: userId=${userId}, productId=${productId}, quantity=${quantity}`);
      
      return cart;
    } catch (error) {
      logger.error(`Error in updateItemQuantity service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove item from cart
   */
  async removeItem(userId, productId) {
    try {
      const cart = await cartQueries.removeItem(userId, productId);

      logger.info(`Item removed from cart: userId=${userId}, productId=${productId}`);
      
      return cart;
    } catch (error) {
      logger.error(`Error in removeItem service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove multiple items from cart
   */
  async removeMultipleItems(userId, productIds) {
    try {
      if (!Array.isArray(productIds) || productIds.length === 0) {
        throw new Error('Product IDs array is required and must not be empty');
      }

      const cart = await cartQueries.removeMultipleItems(userId, productIds);

      logger.info(`Multiple items removed from cart: userId=${userId}, count=${productIds.length}`);
      
      return cart;
    } catch (error) {
      logger.error(`Error in removeMultipleItems service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear cart
   */
  async clearCart(userId) {
    try {
      const cart = await cartQueries.clearCart(userId);

      logger.info(`Cart cleared: userId=${userId}`);
      
      return cart;
    } catch (error) {
      logger.error(`Error in clearCart service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Apply coupon
   */
  async applyCoupon(userId, couponCode) {
    try {
      // TODO: Fetch coupon details from coupon service
      // For now, using mock data
      const couponData = await this.validateCoupon(couponCode);

      if (!couponData.valid) {
        throw new Error('Invalid or expired coupon');
      }

      const cart = await cartQueries.applyCoupon(
        userId,
        couponCode,
        couponData.discount,
        couponData.type
      );

      logger.info(`Coupon applied: userId=${userId}, code=${couponCode}`);
      
      return cart;
    } catch (error) {
      logger.error(`Error in applyCoupon service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove coupon
   */
  async removeCoupon(userId, couponCode) {
    try {
      const cart = await cartQueries.removeCoupon(userId, couponCode);

      logger.info(`Coupon removed: userId=${userId}, code=${couponCode}`);
      
      return cart;
    } catch (error) {
      logger.error(`Error in removeCoupon service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get cart summary
   */
  async getCartSummary(userId) {
    try {
      return await cartQueries.getCartSummary(userId);
    } catch (error) {
      logger.error(`Error in getCartSummary service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check cart availability
   */
  async checkAvailability(userId) {
    try {
      return await cartQueries.checkAvailability(userId);
    } catch (error) {
      logger.error(`Error in checkAvailability service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sync cart with latest product data
   */
  async syncCart(userId) {
    try {
      const cart = await cartQueries.syncCartWithProducts(userId);

      logger.info(`Cart synced: userId=${userId}`);
      
      return cart;
    } catch (error) {
      logger.error(`Error in syncCart service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Merge guest cart with user cart
   */
  async mergeCarts(userId, sessionId) {
    try {
      const cart = await cartQueries.mergeCarts(userId, sessionId);

      logger.info(`Carts merged: userId=${userId}, sessionId=${sessionId}`);
      
      return cart;
    } catch (error) {
      logger.error(`Error in mergeCarts service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Convert cart to order
   */
  async convertToOrder(userId) {
    try {
      // Check availability before conversion
      const availability = await this.checkAvailability(userId);

      if (!availability.available) {
        throw new Error('Some items in cart are not available');
      }

      // Update cart status
      await cartQueries.updateStatus(userId, 'converted');

      logger.info(`Cart converted to order: userId=${userId}`);
      
      return { success: true };
    } catch (error) {
      logger.error(`Error in convertToOrder service: ${error.message}`);
      throw error;
    }
  }

  // ===== Helper Methods =====

  /**
   * Fetch single product details from product service
   */
  async fetchProductDetails(productId) {
    try {
      const url = `${PRODUCT_SERVICE_URL}/api/v1/products/${productId}`;
      logger.info(`PRODUCT_SERVICE_URL resolved to ${url}`);
      const response = await axios.get(url, { timeout: 5000 });

      if (response?.data?.success) {
        logger.info(`Fetched product details: productId=${productId}`);
        logger.warn(`Product service returneds for ${productId}: ${JSON.stringify(response?.data)}`);
        return response.data.data;
      }

      logger.warn(`Product service returned non-success for ${productId}: ${JSON.stringify(response?.data)}`);
      return null;
    } catch (error) {
      // Add more detailed message for connection errors
      logger.error(`Error fetching product details from ${PRODUCT_SERVICE_URL} for productId=${productId}: ${error.message}`);
      // If you want to keep original behavior: throw new Error('Failed to fetch product details');
      throw error; // bubble up with original error to help debugging
    }
  }

  /**
   * Fetch multiple products details
   */
  async fetchMultipleProducts(productIds) {
    try {
      // Fetch products in parallel
      const promises = productIds.map(id => this.fetchProductDetails(id));
      const results = await Promise.allSettled(promises);

      // Filter successful results
      return results
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);
    } catch (error) {
      logger.error(`Error fetching multiple products: ${error.message}`);
      throw new Error('Failed to fetch product details');
    }
  }

  /**
   * Validate coupon (mock implementation)
   */
  async validateCoupon(couponCode) {
    try {
      // TODO: Call coupon service
      // Mock validation
      const mockCoupons = {
        'SAVE10': { valid: true, discount: 10, type: 'percentage' },
        'FLAT50': { valid: true, discount: 50, type: 'fixed' }
      };

      return mockCoupons[couponCode] || { valid: false };
    } catch (error) {
      logger.error(`Error validating coupon: ${error.message}`);
      throw new Error('Failed to validate coupon');
    }
  }

  /**
   * Get abandoned carts
   */
  async getAbandonedCarts(daysOld = 1) {
    try {
      return await cartQueries.getAbandonedCarts(daysOld);
    } catch (error) {
      logger.error(`Error in getAbandonedCarts service: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get cart statistics
   */
  async getCartStatistics() {
    try {
      return await cartQueries.getCartStatistics();
    } catch (error) {
      logger.error(`Error in getCartStatistics service: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new CartService();