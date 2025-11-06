const productQueries = require('../data/productQueries');
const logger = require('../utils/logger');

class ProductService {
  async getAllProducts(filters = {}, page = 1, limit = 20, sort = '-createdAt') {
    try {
      logger.info('SIGINT received, shutting down gracefully...');
      return await productQueries.findAll(filters, page, limit, sort);
    } catch (error) {
      logger.error(`Error getting products: ${error.message}`);
      throw error;
    }
  }

  async getProductById(productId) {
    try {
      return await productQueries.findById(productId);
    } catch (error) {
      logger.error(`Error getting product: ${error.message}`);
      throw error;
    }
  }

  async createProduct(productData) {
    try {
      // Check if SKU already exists
      const existingProduct = await productQueries.findBySku(productData.sku);
      if (existingProduct) {
        throw new Error('Product with this SKU already exists');
      }

      return await productQueries.create(productData);
    } catch (error) {
      logger.error(`Error creating product: ${error.message}`);
      throw error;
    }
  }

  async updateProduct(productId, updateData) {
    try {
      return await productQueries.updateById(productId, updateData);
    } catch (error) {
      logger.error(`Error updating product: ${error.message}`);
      throw error;
    }
  }

  async deleteProduct(productId) {
    try {
      return await productQueries.deleteById(productId);
    } catch (error) {
      logger.error(`Error deleting product: ${error.message}`);
      throw error;
    }
  }

  async getProductsByCategory(category, page = 1, limit = 20) {
    try {
      return await productQueries.findByCategory(category, page, limit);
    } catch (error) {
      logger.error(`Error getting products by category: ${error.message}`);
      throw error;
    }
  }

  async updateStock(productId, quantity) {
    try {
      return await productQueries.updateStock(productId, quantity);
    } catch (error) {
      logger.error(`Error updating stock: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ProductService();