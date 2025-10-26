const productService = require('../services/productService');
const logger = require('../utils/logger');

// Get all products with filters
exports.getAllProducts = async (req, res, next) => {
  try {
    const { category, subcategory, minPrice, maxPrice, search, page = 1, limit = 20, sort = '-createdAt' } = req.query;

    const filters = {};
    if (category) filters.category = category;
    if (subcategory) filters.subcategory = subcategory;
    if (minPrice || maxPrice) {
      filters.price = {};
      if (minPrice) filters.price.$gte = parseFloat(minPrice);
      if (maxPrice) filters.price.$lte = parseFloat(maxPrice);
    }
    if (search) filters.$text = { $search: search };

    const products = await productService.getAllProducts(
      filters,
      parseInt(page),
      parseInt(limit),
      sort
    );

    res.status(200).json({
      success: true,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

// Get product by ID
exports.getProductById = async (req, res, next) => {
  try {
    const product = await productService.getProductById(req.params.productId);

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
    next(error);
  }
};

// Create product (admin only)
exports.createProduct = async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.body);

    logger.info(`Product created: ${product.name}`);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// Update product (admin only)
exports.updateProduct = async (req, res, next) => {
  try {
    const product = await productService.updateProduct(req.params.productId, req.body);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    logger.info(`Product updated: ${product.name}`);

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// Delete product (admin only)
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await productService.deleteProduct(req.params.productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    logger.info(`Product deleted: ${product.name}`);

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get products by category
exports.getProductsByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const products = await productService.getProductsByCategory(
      category,
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      data: products
    });
  } catch (error) {
    next(error);
  }
};