const Product = require('../models/ProductMultiReg');
const Category = require('../models/Category');
const logger = require('../utils/logger');

class ProductMultiRegQueries {
  // Create product
  async createProduct(productData) {
    try {
      const product = new Product(productData);
      await product.save();
      return await this.getProductById(product._id);
    } catch (error) {
      logger.error(`Error creating product: ${error.message}`);
      throw error;
    }
  }

  // Get product by ID with full details
  async getProductById(id, region = null) {
    try {
      const product = await Product.findById(id)
        .populate('category', 'name slug')
        .populate('subcategory', 'name slug')
        .lean();

      if (!product) return null;

      // Filter regional pricing if region specified
      if (region) {
        const regionPricing = product.regionalPricing.find(rp => rp.region === region);
        product.pricing = regionPricing || null;
        delete product.regionalPricing;
      }

      return product;
    } catch (error) {
      logger.error(`Error getting product by ID: ${error.message}`);
      throw error;
    }
  }

  // Get products with filters and pagination
  async getProducts(filters = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        region,
        category,
        subcategory,
        brand,
        minPrice,
        maxPrice,
        search,
        tags,
        isFeatured,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = filters;

      const query = { isActive: true };

      // Region filter
      if (region) {
        query['regionalPricing.region'] = region;
        query['regionalPricing.available'] = true;
      }

      // Category filters
      if (category) {
        query.category = category;
      }
      if (subcategory) {
        query.subcategory = subcategory;
      }

      // Brand filter
      if (brand) {
        query.brand = new RegExp(brand, 'i');
      }

      // Price filter (only works with specific region)
      if (region && (minPrice || maxPrice)) {
        const priceQuery = {};
        if (minPrice) priceQuery.$gte = Number(minPrice);
        if (maxPrice) priceQuery.$lte = Number(maxPrice);
        query['regionalPricing'] = {
          $elemMatch: {
            region,
            $or: [
              { salePrice: priceQuery },
              { $and: [{ salePrice: { $exists: false } }, { basePrice: priceQuery }] }
            ]
          }
        };
      }

      // Search filter
      if (search) {
        query.$text = { $search: search };
      }

      // Tags filter
      if (tags) {
        query.tags = { $in: Array.isArray(tags) ? tags : [tags] };
      }

      // Featured filter
      if (isFeatured !== undefined) {
        query.isFeatured = isFeatured === 'true' || isFeatured === true;
      }

      // Build sort object
      const sort = {};
      if (search) {
        sort.score = { $meta: 'textScore' };
      }
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query with pagination
      const skip = (page - 1) * limit;
      
      const [products, total] = await Promise.all([
        Product.find(query)
          .populate('category', 'name slug')
          .populate('subcategory', 'name slug')
          .sort(sort)
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        Product.countDocuments(query)
      ]);

      // Filter regional pricing if region specified
      if (region) {
        products.forEach(product => {
          const regionPricing = product.regionalPricing.find(rp => rp.region === region);
          product.pricing = regionPricing || null;
          delete product.regionalPricing;
        });
      }

      return {
        products,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error getting products: ${error.message}`);
      throw error;
    }
  }

  // Update product
  async updateProduct(id, updateData, userId) {
    try {
      updateData.updatedBy = userId;
      
      const product = await Product.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      )
        .populate('category', 'name slug')
        .populate('subcategory', 'name slug');

      return product;
    } catch (error) {
      logger.error(`Error updating product: ${error.message}`);
      throw error;
    }
  }

  // Update regional pricing
  async updateRegionalPricing(id, region, pricingData) {
    try {
      const product = await Product.findById(id);
      if (!product) return null;

      const regionIndex = product.regionalPricing.findIndex(rp => rp.region === region);
      
      if (regionIndex >= 0) {
        // Update existing region
        Object.assign(product.regionalPricing[regionIndex], pricingData);
      } else {
        // Add new region
        product.regionalPricing.push({ region, ...pricingData });
      }

      await product.save();
      return product;
    } catch (error) {
      logger.error(`Error updating regional pricing: ${error.message}`);
      throw error;
    }
  }

  // Update inventory
  async updateInventory(id, region, quantity, warehouse) {
    try {
      const product = await Product.findById(id);
      if (!product) return null;

      const inventoryIndex = product.inventory.findIndex(
        inv => inv.region === region && inv.warehouse === warehouse
      );

      if (inventoryIndex >= 0) {
        product.inventory[inventoryIndex].quantity = quantity;
        product.inventory[inventoryIndex].lastUpdated = new Date();
      } else {
        product.inventory.push({ region, quantity, warehouse });
      }

      await product.save();
      return product;
    } catch (error) {
      logger.error(`Error updating inventory: ${error.message}`);
      throw error;
    }
  }

  // Delete product (soft delete)
  async deleteProduct(id) {
    try {
      const product = await Product.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      );
      return product;
    } catch (error) {
      logger.error(`Error deleting product: ${error.message}`);
      throw error;
    }
  }

  // Get products by category including subcategories
  async getProductsByCategory(categoryId, options = {}) {
    try {
      const category = await Category.findById(categoryId);
      if (!category) return { products: [], pagination: {} };

      // Get all descendant categories
      const descendants = await Category.getDescendants(categoryId);
      const categoryIds = [categoryId, ...descendants.map(d => d._id)];

      return this.getProducts({
        ...options,
        category: { $in: categoryIds }
      });
    } catch (error) {
      logger.error(`Error getting products by category: ${error.message}`);
      throw error;
    }
  }

  // Get low stock products
  async getLowStockProducts(threshold = 10, region = null) {
    try {
      const query = { isActive: true };
      
      if (region) {
        query['inventory.region'] = region;
      }

      const products = await Product.find(query)
        .populate('category', 'name slug')
        .lean();

      return products.filter(product => {
        const relevantInventory = region 
          ? product.inventory.filter(inv => inv.region === region)
          : product.inventory;
        
        const totalQuantity = relevantInventory.reduce((sum, inv) => sum + inv.quantity, 0);
        return totalQuantity <= threshold;
      });
    } catch (error) {
      logger.error(`Error getting low stock products: ${error.message}`);
      throw error;
    }
  }

  // Bulk update prices for region
  async bulkUpdateRegionalPrices(updates) {
    try {
      const bulkOps = updates.map(({ productId, region, pricing }) => ({
        updateOne: {
          filter: { 
            _id: productId,
            'regionalPricing.region': region 
          },
          update: {
            $set: {
              'regionalPricing.$.basePrice': pricing.basePrice,
              'regionalPricing.$.salePrice': pricing.salePrice,
              'regionalPricing.$.tax': pricing.tax
            }
          }
        }
      }));

      const result = await Product.bulkWrite(bulkOps);
      return result;
    } catch (error) {
      logger.error(`Error bulk updating prices: ${error.message}`);
      throw error;
    }
  }

  // Get product analytics
  async getProductAnalytics(productId) {
    try {
      const product = await Product.findById(productId).lean();
      if (!product) return null;

      return {
        productId,
        name: product.name,
        sku: product.sku,
        totalInventory: product.inventory.reduce((sum, inv) => sum + inv.quantity, 0),
        inventoryByRegion: product.inventory.reduce((acc, inv) => {
          if (!acc[inv.region]) acc[inv.region] = 0;
          acc[inv.region] += inv.quantity;
          return acc;
        }, {}),
        availableRegions: product.availableRegions,
        regionalPricing: product.regionalPricing,
        ratings: product.ratings,
        isFeatured: product.isFeatured
      };
    } catch (error) {
      logger.error(`Error getting product analytics: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new ProductMultiRegQueries();