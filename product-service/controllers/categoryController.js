const Category = require('../models/Category');
const logger = require('../utils/logger');

class CategoryController {
  // Create category
  async   createCategory(req, res) {
    try {
      req.body.createdBy = req.user.id;
      const category = new Category(req.body);
      await category.save();

      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: category
      });
    } catch (error) {
      logger.error(`Error creating category: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create category'
      });
    }
  }

  // Get category by ID
  async getCategory(req, res) {
    try {
      const category = await Category.findById(req.params.id)
        .populate('parent', 'name slug')
        .populate('subcategories');

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      res.status(200).json({
        success: true,
        data: category
      });
    } catch (error) {
      logger.error(`Error getting category: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch category'
      });
    }
  }

  // Get all categories
  async getCategories(req, res) {
    try {
      const { parent, level, isActive = true } = req.query;
      
      const query = {};
      if (parent !== undefined) {
        query.parent = parent === 'null' ? null : parent;
      }
      if (level !== undefined) {
        query.level = Number(level);
      }
      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      const categories = await Category.find(query)
        .populate('parent', 'name slug')
        .sort({ order: 1, name: 1 });

      res.status(200).json({
        success: true,
        data: categories,
        count: categories.length
      });
    } catch (error) {
      logger.error(`Error getting categories: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch categories'
      });
    }
  }

  // Get category tree
  async getCategoryTree(req, res) {
    try {
      const tree = await Category.getTree();

      res.status(200).json({
        success: true,
        data: tree
      });
    } catch (error) {
      logger.error(`Error getting category tree: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch category tree'
      });
    }
  }

  // Get category path
  async getCategoryPath(req, res) {
    try {
      const category = await Category.findById(req.params.id);

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      const path = await category.getPath();

      res.status(200).json({
        success: true,
        data: path
      });
    } catch (error) {
      logger.error(`Error getting category path: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch category path'
      });
    }
  }

  // Update category
  async updateCategory(req, res) {
    try {
      req.body.updatedBy = req.user.id;
      
      const category = await Category.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true }
      );

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Category updated successfully',
        data: category
      });
    } catch (error) {
      logger.error(`Error updating category: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update category'
      });
    }
  }

  // Delete category
  async deleteCategory(req, res) {
    try {
      const category = await Category.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Category deleted successfully'
      });
    } catch (error) {
      logger.error(`Error deleting category: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to delete category'
      });
    }
  }
}

module.exports = new CategoryController();