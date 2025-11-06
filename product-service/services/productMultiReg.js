const productQueries = require('../data/productMultiRegQueries');
const { publishEvent } = require('../utils/kafka');
const logger = require('../utils/logger');

// Kafka Topics
const TOPICS = {
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_DELETED: 'product.deleted',
  PRODUCT_PRICE_CHANGED: 'product.price.changed',
  PRODUCT_INVENTORY_CHANGED: 'product.inventory.changed',
  PRODUCT_OUT_OF_STOCK: 'product.out.of.stock'
};

class ProductMultiRegService {
  async createProduct(productData, userId) {
    try {
      productData.createdBy = userId;
      const product = await productQueries.createProduct(productData);

      // Publish event to Kafka
      await this.publishProductEvent(TOPICS.PRODUCT_CREATED, product, {
        action: 'created',
        userId
      });

      logger.info(`Product created: ${product._id}`);
      return product;
    } catch (error) {
      logger.error(`Error in createProduct service: ${error.message}`);
      throw error;
    }
  }

  async getProductById(id, region = null) {
    try {
      return await productQueries.getProductById(id, region);
    } catch (error) {
      logger.error(`Error in getProductById service: ${error.message}`);
      throw error;
    }
  }

  async getProducts(filters) {
    try {
      return await productQueries.getProducts(filters);
    } catch (error) {
      logger.error(`Error in getProducts service: ${error.message}`);
      throw error;
    }
  }

  async updateProduct(id, updateData, userId) {
    try {
      const oldProduct = await productQueries.getProductById(id);
      const product = await productQueries.updateProduct(id, updateData, userId);

      if (!product) {
        throw new Error('Product not found');
      }

      // Publish event to Kafka
      await this.publishProductEvent(TOPICS.PRODUCT_UPDATED, product, {
        action: 'updated',
        userId,
        changes: this.getChanges(oldProduct, product)
      });

      logger.info(`Product updated: ${product._id}`);
      return product;
    } catch (error) {
      logger.error(`Error in updateProduct service: ${error.message}`);
      throw error;
    }
  }

  async updateRegionalPricing(id, region, pricingData, userId) {
    try {
      const oldProduct = await productQueries.getProductById(id);
      const oldPricing = oldProduct?.regionalPricing?.find(rp => rp.region === region);
      
      const product = await productQueries.updateRegionalPricing(id, region, pricingData);

      if (!product) {
        throw new Error('Product not found');
      }

      // Publish price change event
      await this.publishProductEvent(TOPICS.PRODUCT_PRICE_CHANGED, product, {
        action: 'price_changed',
        userId,
        region,
        oldPricing: oldPricing || null,
        newPricing: pricingData
      });

      logger.info(`Regional pricing updated for product ${id} in region ${region}`);
      return product;
    } catch (error) {
      logger.error(`Error in updateRegionalPricing service: ${error.message}`);
      throw error;
    }
  }

  async updateInventory(id, region, quantity, warehouse, userId) {
    try {
      const oldProduct = await productQueries.getProductById(id);
      const product = await productQueries.updateInventory(id, region, quantity, warehouse);

      if (!product) {
        throw new Error('Product not found');
      }

      // Calculate old quantity
      const oldInventoryItem = oldProduct?.inventory?.find(
        inv => inv.region === region && inv.warehouse === warehouse
      );
      const oldQuantity = oldInventoryItem?.quantity || 0;

      // Publish inventory change event
      await this.publishProductEvent(TOPICS.PRODUCT_INVENTORY_CHANGED, product, {
        action: 'inventory_changed',
        userId,
        region,
        warehouse,
        oldQuantity,
        newQuantity: quantity,
        change: quantity - oldQuantity
      });

      // Check for out of stock
      if (quantity === 0 && oldQuantity > 0) {
        await this.publishProductEvent(TOPICS.PRODUCT_OUT_OF_STOCK, product, {
          action: 'out_of_stock',
          region,
          warehouse
        });
        logger.warn(`Product ${id} is out of stock in ${region} - ${warehouse}`);
      }

      logger.info(`Inventory updated for product ${id} in ${region} - ${warehouse}`);
      return product;
    } catch (error) {
      logger.error(`Error in updateInventory service: ${error.message}`);
      throw error;
    }
  }

  async deleteProduct(id, userId) {
    try {
      const product = await productQueries.deleteProduct(id);

      if (!product) {
        throw new Error('Product not found');
      }

      // Publish event to Kafka
      await this.publishProductEvent(TOPICS.PRODUCT_DELETED, product, {
        action: 'deleted',
        userId
      });

      logger.info(`Product deleted: ${product._id}`);
      return product;
    } catch (error) {
      logger.error(`Error in deleteProduct service: ${error.message}`);
      throw error;
    }
  }

  async getProductsByCategory(categoryId, options) {
    try {
      return await productQueries.getProductsByCategory(categoryId, options);
    } catch (error) {
      logger.error(`Error in getProductsByCategory service: ${error.message}`);
      throw error;
    }
  }

  async getLowStockProducts(threshold, region) {
    try {
      return await productQueries.getLowStockProducts(threshold, region);
    } catch (error) {
      logger.error(`Error in getLowStockProducts service: ${error.message}`);
      throw error;
    }
  }

  async bulkUpdateRegionalPrices(updates, userId) {
    try {
      const result = await productQueries.bulkUpdateRegionalPrices(updates);

      // Publish bulk price change event
      await publishEvent(TOPICS.PRODUCT_PRICE_CHANGED, {
        key: 'bulk_update',
        value: {
          action: 'bulk_price_update',
          userId,
          count: updates.length,
          timestamp: new Date().toISOString()
        }
      });

      logger.info(`Bulk price update completed: ${updates.length} products`);
      return result;
    } catch (error) {
      logger.error(`Error in bulkUpdateRegionalPrices service: ${error.message}`);
      throw error;
    }
  }

  async getProductAnalytics(productId) {
    try {
      return await productQueries.getProductAnalytics(productId);
    } catch (error) {
      logger.error(`Error in getProductAnalytics service: ${error.message}`);
      throw error;
    }
  }

  // Helper method to publish product events
  async publishProductEvent(topic, product, metadata = {}) {
    try {
      await publishEvent(topic, {
        key: product._id.toString(),
        value: {
          productId: product._id.toString(),
          sku: product.sku,
          name: product.name,
          category: product.category,
          subcategory: product.subcategory,
          regionalPricing: product.regionalPricing,
          inventory: product.inventory,
          isActive: product.isActive,
          timestamp: new Date().toISOString(),
          ...metadata
        }
      });
    } catch (error) {
      // Log error but don't fail the operation
      logger.error(`Error publishing event to ${topic}: ${error.message}`);
    }
  }

  // Helper to get changes between old and new product
  getChanges(oldProduct, newProduct) {
    const changes = {};
    const fields = ['name', 'description', 'brand', 'isActive', 'isFeatured'];
    
    fields.forEach(field => {
      if (oldProduct[field] !== newProduct[field]) {
        changes[field] = {
          old: oldProduct[field],
          new: newProduct[field]
        };
      }
    });

    return changes;
  }
}

module.exports = new ProductMultiRegService();