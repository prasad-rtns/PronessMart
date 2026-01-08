const Product = require('../models/Product');
const logger = require('../utils/logger');

/**
 * Product Data Access Layer
 * All database queries related to Product model
 */

class ProductQueries {
  /**
   * Find product by ID
   */
  async findById(productId) {
    try {
      return await Product.findById(productId);
    } catch (error) {
      logger.error(`Error in findById query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find product by SKU
   */
  async findBySku(sku) {
    try {
      return await Product.findOne({ sku });
    } catch (error) {
      logger.error(`Error in findBySku query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if product exists by SKU
   */
  async existsBySku(sku) {
    try {
      return await Product.exists({ sku });
    } catch (error) {
      logger.error(`Error in existsBySku query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create new product
   */
  async create(productData) {
    try {
      return await Product.create(productData);
    } catch (error) {
      logger.error(`Error in create query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update product by ID
   */
  async updateById(productId, updateData) {
    try {
      return await Product.findByIdAndUpdate(
        productId,
        { $set: updateData },
        { new: true, runValidators: true }
      );
    } catch (error) {
      logger.error(`Error in updateById query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete product by ID
   */
  async deleteById(productId) {
    try {
      return await Product.findByIdAndDelete(productId);
    } catch (error) {
      logger.error(`Error in deleteById query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all products with filters and pagination
   */
  async findAll(filters = {}, page = 1, limit = 20, sort = '-createdAt') {
    try {
      const skip = (page - 1) * limit;

      // Add isActive filter by default
      const queryFilters = { ...filters, isActive: true };
      logger.debug(
        `🧩 queryFilters:\n${JSON.stringify(queryFilters, null, 2)}`
      );

      const products = await Product.find(queryFilters)
        .skip(skip)
        .limit(limit)
        .sort(sort)
        .lean();

      const total = await Product.countDocuments(queryFilters);

      return {
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error in findAll query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get products by category
   */
  async findByCategory(category, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;

      const products = await Product.find({ category, isActive: true })
        .skip(skip)
        .limit(limit)
        .sort('-createdAt');

      const total = await Product.countDocuments({ category, isActive: true });

      return {
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error in findByCategory query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get products by subcategory
   */
  async findBySubcategory(category, subcategory, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;

      const products = await Product.find({ 
        category, 
        subcategory, 
        isActive: true 
      })
        .skip(skip)
        .limit(limit)
        .sort('-createdAt');

      const total = await Product.countDocuments({ 
        category, 
        subcategory, 
        isActive: true 
      });

      return {
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error in findBySubcategory query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search products by text
   */
  async searchProducts(searchTerm, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;

      const products = await Product.find(
        { 
          $text: { $search: searchTerm },
          isActive: true 
        },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limit);

      const total = await Product.countDocuments({ 
        $text: { $search: searchTerm },
        isActive: true 
      });

      return {
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error in searchProducts query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get products by price range
   */
  async findByPriceRange(minPrice, maxPrice, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;

      const filters = {
        price: { $gte: minPrice, $lte: maxPrice },
        isActive: true
      };

      const products = await Product.find(filters)
        .skip(skip)
        .limit(limit)
        .sort('price');

      const total = await Product.countDocuments(filters);

      return {
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error in findByPriceRange query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get featured products
   */
  async findFeaturedProducts(limit = 10) {
    try {
      return await Product.find({ isFeatured: true, isActive: true })
        .limit(limit)
        .sort('-rating.average');
    } catch (error) {
      logger.error(`Error in findFeaturedProducts query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get products by brand
   */
  async findByBrand(brand, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;

      const products = await Product.find({ brand, isActive: true })
        .skip(skip)
        .limit(limit)
        .sort('-createdAt');

      const total = await Product.countDocuments({ brand, isActive: true });

      return {
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error in findByBrand query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update product stock
   */
  async updateStock(productId, quantity) {
    try {
      const product = await Product.findById(productId);
      
      if (!product) {
        throw new Error('Product not found');
      }

      product.stock += quantity;

      if (product.stock < 0) {
        throw new Error('Insufficient stock');
      }

      // Update availability based on stock
      if (product.stock === 0) {
        product.availability = 'out_of_stock';
      } else if (product.availability === 'out_of_stock' && product.stock > 0) {
        product.availability = 'in_stock';
      }

      return await product.save();
    } catch (error) {
      logger.error(`Error in updateStock query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update product rating
   */
  async updateRating(productId, newRating) {
    try {
      const product = await Product.findById(productId);
      
      if (!product) {
        throw new Error('Product not found');
      }

      const currentAverage = product.rating.average;
      const currentCount = product.rating.count;

      // Calculate new average
      const newAverage = ((currentAverage * currentCount) + newRating) / (currentCount + 1);

      product.rating.average = Math.round(newAverage * 10) / 10; // Round to 1 decimal
      product.rating.count += 1;

      return await product.save();
    } catch (error) {
      logger.error(`Error in updateRating query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get low stock products
   */
  async findLowStockProducts(threshold = 10) {
    try {
      return await Product.find({
        stock: { $lte: threshold, $gt: 0 },
        isActive: true
      }).sort('stock');
    } catch (error) {
      logger.error(`Error in findLowStockProducts query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get out of stock products
   */
  async findOutOfStockProducts() {
    try {
      return await Product.find({
        stock: 0,
        isActive: true
      });
    } catch (error) {
      logger.error(`Error in findOutOfStockProducts query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bulk update products
   */
  async bulkUpdate(filter, updateData) {
    try {
      return await Product.updateMany(filter, { $set: updateData });
    } catch (error) {
      logger.error(`Error in bulkUpdate query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get product statistics
   */
  async getProductStats() {
    try {
      const totalProducts = await Product.countDocuments({ isActive: true });
      const outOfStock = await Product.countDocuments({ stock: 0, isActive: true });
      const lowStock = await Product.countDocuments({ 
        stock: { $lte: 10, $gt: 0 }, 
        isActive: true 
      });

      const categories = await Product.distinct('category');
      const brands = await Product.distinct('brand');

      return {
        totalProducts,
        outOfStock,
        lowStock,
        inStock: totalProducts - outOfStock,
        totalCategories: categories.length,
        totalBrands: brands.length
      };
    } catch (error) {
      logger.error(`Error in getProductStats query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all categories
   */
  async getAllCategories() {
    try {
      return await Product.distinct('category', { isActive: true });
    } catch (error) {
      logger.error(`Error in getAllCategories query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all brands
   */
  async getAllBrands() {
    try {
      return await Product.distinct('brand', { isActive: true });
    } catch (error) {
      logger.error(`Error in getAllBrands query: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ProductQueries();