const productService = require('../services/productMultiRegService');
const logger = require('../utils/logger');

class ProductMultiRegController {
  // Create new product
  async createProduct(req, res) {
    try {
      const product = await productService.createProduct(req.body, req.user.id);
      
      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product
      });
    } catch (error) {
      logger.error(`Error in createProduct controller: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create product'
      });
    }
  }

  // Get product by ID
  async getProduct(req, res) {
    try {
      const { id } = req.params;
      const { region } = req.query;
      
      const product = await productService.getProductById(id, region);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.status(200).json({
        success: true,
        data: product
      });
    } catch (error) {
      logger.error(`Error in getProduct controller: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch product'
      });
    }
  }

  // Get all products with filters
  async getProducts(req, res) {
    try {
      const filters = {
        page: req.query.page,
        limit: req.query.limit,
        region: req.query.region,
        category: req.query.category,
        subcategory: req.query.subcategory,
        brand: req.query.brand,
        minPrice: req.query.minPrice,
        maxPrice: req.query.maxPrice,
        search: req.query.search,
        tags: req.query.tags,
        isFeatured: req.query.isFeatured,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder
      };

      const result = await productService.getProducts(filters);

      res.status(200).json({
        success: true,
        data: result.products,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error(`Error in getProducts controller: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch products'
      });
    }
  }

  // Update product
  async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const product = await productService.updateProduct(id, req.body, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        data: product
      });
    } catch (error) {
      logger.error(`Error in updateProduct controller: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update product'
      });
    }
  }

  // Update regional pricing
  async updateRegionalPricing(req, res) {
    try {
      const { id, region } = req.params;
      const product = await productService.updateRegionalPricing(
        id,
        region,
        req.body,
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: 'Regional pricing updated successfully',
        data: product
      });
    } catch (error) {
      logger.error(`Error in updateRegionalPricing controller: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update regional pricing'
      });
    }
  }

  // Update inventory
  async updateInventory(req, res) {
    try {
      const { id } = req.params;
      const { region, quantity, warehouse } = req.body;

      if (!region || quantity === undefined || !warehouse) {
        return res.status(400).json({
          success: false,
          message: 'Region, quantity, and warehouse are required'
        });
      }

      const product = await productService.updateInventory(
        id,
        region,
        quantity,
        warehouse,
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: 'Inventory updated successfully',
        data: product
      });
    } catch (error) {
      logger.error(`Error in updateInventory controller: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update inventory'
      });
    }
  }

  // Delete product
  async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      await productService.deleteProduct(id, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      logger.error(`Error in deleteProduct controller: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to delete product'
      });
    }
  }

  // Get products by category
  async getProductsByCategory(req, res) {
    try {
      const { categoryId } = req.params;
      const options = {
        page: req.query.page,
        limit: req.query.limit,
        region: req.query.region,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder
      };

      const result = await productService.getProductsByCategory(categoryId, options);

      res.status(200).json({
        success: true,
        data: result.products,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error(`Error in getProductsByCategory controller: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch products by category'
      });
    }
  }

  // Get low stock products
  async getLowStockProducts(req, res) {
    try {
      const { threshold = 10, region } = req.query;
      const products = await productService.getLowStockProducts(
        Number(threshold),
        region
      );

      res.status(200).json({
        success: true,
        data: products,
        count: products.length
      });
    } catch (error) {
      logger.error(`Error in getLowStockProducts controller: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch low stock products'
      });
    }
  }

  // Bulk update regional prices
  async bulkUpdatePrices(req, res) {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Updates array is required and must not be empty'
        });
      }

      const result = await productService.bulkUpdateRegionalPrices(
        updates,
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: 'Prices updated successfully',
        data: {
          matched: result.matchedCount,
          modified: result.modifiedCount
        }
      });
    } catch (error) {
      logger.error(`Error in bulkUpdatePrices controller: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update prices'
      });
    }
  }

  // Get product analytics
  async getProductAnalytics(req, res) {
    try {
      const { id } = req.params;
      const analytics = await productService.getProductAnalytics(id);

      if (!analytics) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.status(200).json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error(`Error in getProductAnalytics controller: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch analytics'
      });
    }
  }
}

module.exports = new ProductMultiRegController();