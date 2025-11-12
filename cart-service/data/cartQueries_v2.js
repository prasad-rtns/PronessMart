const Cart = require('../models/Cart');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const isValidObjectId = mongoose.isValidObjectId;

/**
 * Cart Data Access Layer
 * All database queries related to Cart model
 */

class CartQueries {
  /**
   * Find cart by user ID or session with status filter
   */
  async findByUserOrSession(identifier, status = 'active') {
    try {
      const query = isValidObjectId(identifier)
        ? { userId: identifier, status }
        : { sessionId: identifier, status };

      const cart = await Cart.findOne(query).lean();
      if (!cart) return null;

      // ensure productId is visible in response
      cart.items = (cart.items || []).map(item => ({
        ...item,
        productId: item.product ? item.product.toString() : null
      }));

      return cart;
    } catch (error) {
      logger.error(`Error in findByUserOrSession query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find cart by ID
   */
  async findById(cartId) {
    try {
      const cart = await Cart.findById(cartId).lean();
      if (!cart) return null;
      cart.items = (cart.items || []).map(item => ({
        ...item,
        productId: item.product ? item.product.toString() : null
      }));
      return cart;
    } catch (error) {
      logger.error(`Error in findById query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find or create cart for user
   * UPDATED: Always query with status: 'active'
   */
  async findOrCreate(userId, sessionId = null) {
    try {
      let query = userId ? { userId, status: 'active' } : { sessionId, status: 'active' };
      let cart = await Cart.findOne(query);
      
      if (!cart) {
        // create using only the fields that exist
        const doc = {
          items: [],
          status: 'active'
        };
        if (userId) doc.userId = userId;
        if (sessionId) doc.sessionId = sessionId;

        cart = new Cart(doc);
        await cart.save();
        logger.info(`Created new active cart for ${userId ? 'userId: ' + userId : 'sessionId: ' + sessionId}`);
      }
      
      return await this.findByUserOrSession(userId || sessionId);
    } catch (error) {
      logger.error(`Error in findOrCreate query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add single item to cart
   * UPDATED: Ensures query includes status: 'active'
   */
  async addItem(userId, productData, quantity = 1, sessionId = null) {
    try {
      const query = userId ? { userId, status: 'active' } : { sessionId, status: 'active' };
      const doc = { items: [], status: 'active' };
      if (userId) doc.userId = userId;
      if (sessionId) doc.sessionId = sessionId;

      // 1) create if missing atomically with status: 'active'
      const cart = await Cart.findOneAndUpdate(
        query,
        { $setOnInsert: doc },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).exec();

      // 2) modify cart (in-memory), then save
      const cartDoc = await Cart.findById(cart._id);
      cartDoc.addItem(productData, quantity);
      
      try {
        await cartDoc.save();
      } catch (err) {
        // if duplicate (race), re-fetch and retry the update once
        if (err && err.code === 11000) {
          logger.warn('Duplicate key on addItem, retrying fetch...');
          const fresh = await Cart.findOne(query);
          if (!fresh) throw err;
          // add item to fresh cart and save
          fresh.addItem(productData, quantity);
          await fresh.save();
          return await this.findByUserOrSession(userId || sessionId);
        }
        throw err;
      }

      return await this.findByUserOrSession(userId || sessionId);
    } catch (error) {
      logger.error(`Error in addItem query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add multiple items to cart
   * UPDATED: Properly handles status: 'active' in all queries
   */
  async addMultipleItems(userId, items, sessionId = null) {
    try {
      // Ensure we always have either userId or sessionId
      if (!userId && !sessionId) {
        sessionId = `guest_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        logger.debug(`Generated guest sessionId: ${sessionId}`);
      }

      // CRITICAL: Always include status: 'active' in query
      const query = userId ? { userId, status: 'active' } : { sessionId, status: 'active' };
      const doc = { items: [], status: 'active' };
      if (userId) doc.userId = userId;
      if (sessionId) doc.sessionId = sessionId;

      logger.info(`Adding multiple items with query: ${JSON.stringify(query)}`);

      // 1️⃣ Atomically create cart if it doesn't exist (with status: 'active')
      const cart = await Cart.findOneAndUpdate(
        query,
        { $setOnInsert: doc },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).exec();

      logger.info(`Cart ${cart._id} found/created with status: ${cart.status}`);

      // 2️⃣ Fetch fresh doc for in-memory updates
      const cartDoc = await Cart.findById(cart._id);

      // 3️⃣ Process each incoming item
      for (const item of items) {
        const existingIndex = cartDoc.items.findIndex(
          i => i.product.toString() === item.productData._id.toString()
        );

        if (existingIndex >= 0) {
          // Replace (set) quantity instead of incrementing
          cartDoc.items[existingIndex].quantity = item.quantity;
          cartDoc.items[existingIndex].subtotal =
            cartDoc.items[existingIndex].priceAtAdd * item.quantity;
        } else {
          // Add new product
          cartDoc.addItem(item.productData, item.quantity);
        }
      }

      // 4️⃣ Save cart safely with duplicate-key retry (race-proof)
      try {
        await cartDoc.save();
        logger.info(`Successfully saved cart ${cart._id} with ${cartDoc.items.length} items`);
      } catch (err) {
        if (err && err.code === 11000) {
          logger.warn('Duplicate key on addMultipleItems, retrying fetch...');
          const fresh = await Cart.findOne(query);
          if (!fresh) {
            logger.error('Could not find cart after duplicate key error');
            throw err;
          }

          // Apply the same logic again on the fresh document
          for (const item of items) {
            const existingIndex = fresh.items.findIndex(
              i => i.product.toString() === item.productData._id.toString()
            );

            if (existingIndex >= 0) {
              fresh.items[existingIndex].quantity = item.quantity;
              fresh.items[existingIndex].subtotal =
                fresh.items[existingIndex].priceAtAdd * item.quantity;
            } else {
              fresh.addItem(item.productData, item.quantity);
            }
          }

          await fresh.save();
          logger.info(`Successfully saved cart on retry with ${fresh.items.length} items`);
          return await this.findByUserOrSession(userId || sessionId);
        }
        logger.error(`Error saving cart: ${err.message}`);
        throw err;
      }

      // 5️⃣ Return final updated cart
      return await this.findByUserOrSession(userId || sessionId);
    } catch (error) {
      logger.error(`Error in addMultipleItems query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update item quantity
   */
  async updateItemQuantity(userId, productId, quantity) {
    try {
      const cart = await Cart.findOne({ userId: userId, status: 'active' });
      
      if (!cart) {
        throw new Error('Active cart not found');
      }

      cart.updateItemQuantity(productId, quantity);
      await cart.save();

      return await this.findByUserOrSession(userId);
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
      const cart = await Cart.findOne({ userId: userId, status: 'active' });
      
      if (!cart) {
        throw new Error('Active cart not found');
      }

      cart.removeItem(productId);
      await cart.save();

      return await this.findByUserOrSession(userId);
    } catch (error) {
      logger.error(`Error in removeItem query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove multiple items from cart
   */
  async removeMultipleItems(userId, productIds) {
    try {
      const cart = await Cart.findOne({ userId: userId, status: 'active' });
      
      if (!cart) {
        throw new Error('Active cart not found');
      }

      // Remove each item
      for (const productId of productIds) {
        cart.removeItem(productId);
      }

      await cart.save();

      return await this.findByUserOrSession(userId);
    } catch (error) {
      logger.error(`Error in removeMultipleItems query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear cart
   */
  async clearCart(userId) {
    try {
      const cart = await Cart.findOne({ userId: userId, status: 'active' });
      
      if (!cart) {
        throw new Error('Active cart not found');
      }

      cart.clearCart();
      await cart.save();

      return await this.findByUserOrSession(userId);
    } catch (error) {
      logger.error(`Error in clearCart query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Apply coupon to cart
   */
  async applyCoupon(userId, couponCode, discountAmount, discountType) {
    try {
      const cart = await Cart.findOne({ userId: userId, status: 'active' });
      
      if (!cart) {
        throw new Error('Active cart not found');
      }

      cart.applyCoupon(couponCode, discountAmount, discountType);
      await cart.save();

      return await this.findByUserOrSession(userId);
    } catch (error) {
      logger.error(`Error in applyCoupon query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove coupon from cart
   */
  async removeCoupon(userId, couponCode) {
    try {
      const cart = await Cart.findOne({ userId: userId, status: 'active' });
      
      if (!cart) {
        throw new Error('Active cart not found');
      }

      cart.removeCoupon(couponCode);
      await cart.save();

      return await this.findByUserOrSession(userId);
    } catch (error) {
      logger.error(`Error in removeCoupon query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update cart status
   * UPDATED: Better logging and error handling
   */
  async updateStatus(userId, status) {
    try {
      const cart = await Cart.findOneAndUpdate(
        { userId: userId, status: 'active' },
        { $set: { status } },
        { new: true }
      );

      if (!cart) {
        logger.warn(`No active cart found for userId: ${userId} when updating status to ${status}`);
        throw new Error('Active cart not found');
      }

      logger.info(`Cart status updated: userId=${userId}, oldStatus=active, newStatus=${status}`);
      return cart;
    } catch (error) {
      logger.error(`Error in updateStatus query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Merge carts (e.g., guest cart into user cart on login)
   */
  async mergeCarts(targetUserId, sourceSessionId) {
    try {
      const targetCart = await Cart.findOne({ userId: targetUserId, status: 'active' });
      const sourceCart = await Cart.findOne({ sessionId: sourceSessionId, status: 'active' });

      if (!sourceCart || sourceCart.items.length === 0) {
        return targetCart || await this.findOrCreate(targetUserId);
      }

      if (!targetCart) {
        // Move source cart to target user
        sourceCart.userId = targetUserId;
        sourceCart.status = 'active';
        await sourceCart.save();
        return await this.findByUserOrSession(targetUserId);
      }

      // Merge items from source to target
      for (const item of sourceCart.items) {
        const existingItem = targetCart.items.find(
          i => i.product.toString() === item.product.toString()
        );

        if (existingItem) {
          existingItem.quantity += item.quantity;
          existingItem.subtotal = existingItem.quantity * existingItem.priceAtAdd;
        } else {
          targetCart.items.push(item);
        }
      }

      // Mark source cart as merged
      sourceCart.status = 'merged';
      await sourceCart.save();

      await targetCart.save();

      return await this.findByUserOrSession(targetUserId);
    } catch (error) {
      logger.error(`Error in mergeCarts query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get cart summary
   */
  async getCartSummary(userId) {
    try {
      const cart = await this.findByUserOrSession(userId);

      if (!cart) {
        return {
          itemCount: 0,
          totalQuantity: 0,
          subtotal: 0,
          discount: 0,
          tax: 0,
          total: 0,
          savings: 0
        };
      }

      return {
        itemCount: cart.itemCount,
        totalQuantity: cart.totalQuantity,
        subtotal: cart.subtotal,
        discount: cart.discount,
        tax: cart.tax,
        total: cart.total,
        savings: cart.savings || 0
      };
    } catch (error) {
      logger.error(`Error in getCartSummary query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check product availability in cart
   */
  async checkAvailability(userId) {
    try {
      const cart = await Cart.findOne({ userId: userId, status: 'active' })
        .populate('items.product', 'name stock availability');

      if (!cart) {
        return { available: true, unavailableItems: [] };
      }

      const unavailableItems = [];

      for (const item of cart.items) {
        if (!item.product) {
          unavailableItems.push({
            productId: item.product,
            reason: 'Product not found'
          });
          continue;
        }

        if (item.product.availability !== 'in_stock') {
          unavailableItems.push({
            productId: item.product._id,
            productName: item.product.name,
            reason: `Product is ${item.product.availability}`
          });
        } else if (item.product.stock < item.quantity) {
          unavailableItems.push({
            productId: item.product._id,
            productName: item.product.name,
            reason: `Insufficient stock. Available: ${item.product.stock}, Requested: ${item.quantity}`
          });
        }
      }

      return {
        available: unavailableItems.length === 0,
        unavailableItems
      };
    } catch (error) {
      logger.error(`Error in checkAvailability query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get abandoned carts
   */
  async getAbandonedCarts(daysOld = 1) {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      
      return await Cart.find({
        status: 'active',
        lastActivity: { $lt: cutoffDate },
        itemCount: { $gt: 0 }
      })
        .populate('userId', 'email name')
        .lean();
    } catch (error) {
      logger.error(`Error in getAbandonedCarts query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cleanup abandoned carts
   */
  async cleanupAbandonedCarts(daysOld = 30) {
    try {
      return await Cart.cleanupAbandoned(daysOld);
    } catch (error) {
      logger.error(`Error in cleanupAbandonedCarts query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get cart statistics
   */
  async getCartStatistics() {
    try {
      const [
        totalCarts,
        activeCarts,
        abandonedCarts,
        convertedCarts,
        averageItemCount,
        averageCartValue
      ] = await Promise.all([
        Cart.countDocuments(),
        Cart.countDocuments({ status: 'active' }),
        Cart.countDocuments({ status: 'abandoned' }),
        Cart.countDocuments({ status: 'converted' }),
        Cart.aggregate([
          { $match: { status: 'active' } },
          { $group: { _id: null, avgItems: { $avg: '$itemCount' } } }
        ]),
        Cart.aggregate([
          { $match: { status: 'active' } },
          { $group: { _id: null, avgValue: { $avg: '$total' } } }
        ])
      ]);

      return {
        totalCarts,
        activeCarts,
        abandonedCarts,
        convertedCarts,
        averageItemCount: averageItemCount[0]?.avgItems || 0,
        averageCartValue: averageCartValue[0]?.avgValue || 0
      };
    } catch (error) {
      logger.error(`Error in getCartStatistics query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update product prices in carts (when product price changes)
   */
  async updateProductPricesInCarts(productId, newPrice, comparePrice) {
    try {
      const carts = await Cart.find({
        'items.product': productId,
        status: 'active'
      });

      for (const cart of carts) {
        const item = cart.items.find(i => i.product.toString() === productId.toString());
        if (item) {
          item.productDetails.price = newPrice;
          if (comparePrice !== undefined) {
            item.productDetails.comparePrice = comparePrice;
          }
          // Note: We don't update priceAtAdd as it represents the price when added
        }
        await cart.save();
      }

      return { updated: carts.length };
    } catch (error) {
      logger.error(`Error in updateProductPricesInCarts query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sync cart with latest product data
   */
  async syncCartWithProducts(userId) {
    try {
      const cart = await Cart.findOne({ userId: userId, status: 'active' })
        .populate('items.product');

      if (!cart) {
        return null;
      }

      // Update product details for each item
      for (const item of cart.items) {
        if (item.product) {
          item.productDetails.name = item.product.name;
          item.productDetails.price = item.product.price;
          item.productDetails.comparePrice = item.product.comparePrice;
          item.productDetails.availability = item.product.availability;
          item.productDetails.brand = item.product.brand;
          item.productDetails.category = item.product.category;
          
          if (item.product.images && item.product.images[0]) {
            item.productDetails.image = {
              url: item.product.images[0].url,
              alt: item.product.images[0].alt
            };
          }
        }
      }

      await cart.save();

      return await this.findByUserOrSession(userId);
    } catch (error) {
      logger.error(`Error in syncCartWithProducts query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all carts with filters and pagination
   */
  async getAllCarts(filters = {}, page = 1, limit = 20, sort = "-createdAt") {
    logger.info(`Using filters = ${JSON.stringify(filters)}`);
    try {
      const skip = (page - 1) * limit;

      // Don't default to status: "active" - let it be flexible
      const queryFilters = { ...filters };
      
      // Handle category filter
      if (filters?.category) {
        queryFilters.items = {
          $elemMatch: {
            "productDetails.category": { $regex: new RegExp(filters.category, "i") }
          }
        };
        delete queryFilters.category;
      }

      // Handle SKU filter
      if (filters?.sku) {
        queryFilters.items = {
          $elemMatch: {
            "productDetails.sku": { $regex: new RegExp(filters.sku, "i") }
          }
        };
        delete queryFilters.sku;
      }

      // Handle search filters for name and brand
      if (filters?.search) {
        queryFilters.items = {
          $elemMatch: {
            $or: [
              { "productDetails.name": { $regex: new RegExp(filters.search, "i") } },
              { "productDetails.brand": { $regex: new RegExp(filters.search, "i") } }
            ]
          }
        };
        delete queryFilters.search;
      }

      // Handle individual name filter
      if (filters?.name) {
        queryFilters.items = {
          $elemMatch: {
            "productDetails.name": { $regex: new RegExp(filters.name, "i") }
          }
        };
        delete queryFilters.name;
      }

      // Handle individual brand filter
      if (filters?.brand) {
        queryFilters.items = {
          $elemMatch: {
            "productDetails.brand": { $regex: new RegExp(filters.brand, "i") }
          }
        };
        delete queryFilters.brand;
      }

      // Combine multiple $elemMatch conditions if needed
      if (filters?.category && filters?.sku && (filters?.name || filters?.brand || filters?.search)) {
        const elemMatchConditions = [];
        
        if (filters.category) {
          elemMatchConditions.push({
            "productDetails.category": { $regex: new RegExp(filters.category, "i") }
          });
        }

        if (filters.sku) {
          elemMatchConditions.push({
            "productDetails.sku": { $regex: new RegExp(filters.sku, "i") }
          });
        }
        
        if (filters.search) {
          elemMatchConditions.push({
            $or: [
              { "productDetails.name": { $regex: new RegExp(filters.search, "i") } },
              { "productDetails.brand": { $regex: new RegExp(filters.search, "i") } }
            ]
          });
        } else {
          if (filters.name) {
            elemMatchConditions.push({
              "productDetails.name": { $regex: new RegExp(filters.name, "i") }
            });
          }
          if (filters.brand) {
            elemMatchConditions.push({
              "productDetails.brand": { $regex: new RegExp(filters.brand, "i") }
            });
          }
        }

        queryFilters.items = {
          $elemMatch: {
            $and: elemMatchConditions
          }
        };
      }

      logger.info(`Using queryFilters = ${JSON.stringify(queryFilters)}`);
      
      const carts = await Cart.find(queryFilters)
        .skip(skip)
        .limit(limit)
        .sort(sort);

      const total = await Cart.countDocuments(queryFilters);

      return {
        carts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error in getAllCarts query: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new CartQueries();