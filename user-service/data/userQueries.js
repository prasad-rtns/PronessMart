const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * User Data Access Layer
 * All database queries related to User model
 */

class UserQueries {
  /**
   * Find user by ID
   */
  async findById(userId) {
    try {
      return await User.findById(userId);
    } catch (error) {
      logger.error(`Error in findById query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email) {
    try {
      return await User.findOne({ email }).select('+password');
    } catch (error) {
      logger.error(`Error in findByEmail query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find user by username
   */
  async findByUsername(username) {
    try {
      return await User.findOne({ username }).select('+password');
    } catch (error) {
      logger.error(`Error in findByUsername query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find user by username or email
   */
  async findByUsernameOrEmail(identifier) {
    try {
      return await User.findOne({
        $or: [{ username: identifier }, { email: identifier }]
      }).select('+password');
    } catch (error) {
      logger.error(`Error in findByUsernameOrEmail query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if user exists by email or username
   */
  async existsByEmailOrUsername(email, username) {
    try {
      return await User.findOne({
        $or: [{ email }, { username }]
      });
    } catch (error) {
      logger.error(`Error in existsByEmailOrUsername query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create new user
   */
  async create(userData) {
    try {
      return await User.create(userData);
    } catch (error) {
      logger.error(`Error in create query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user by ID
   */
  async updateById(userId, updateData) {
    try {
      return await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      );
    } catch (error) {
      logger.error(`Error in updateById query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user's last login
   */
  async updateLastLogin(userId) {
    try {
      return await User.findByIdAndUpdate(
        userId,
        { lastLogin: new Date() },
        { new: true }
      );
    } catch (error) {
      logger.error(`Error in updateLastLogin query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete user by ID
   */
  async deleteById(userId) {
    try {
      return await User.findByIdAndDelete(userId);
    } catch (error) {
      logger.error(`Error in deleteById query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Soft delete user (deactivate)
   */
  async softDeleteById(userId) {
    try {
      return await User.findByIdAndUpdate(
        userId,
        { isActive: false },
        { new: true }
      );
    } catch (error) {
      logger.error(`Error in softDeleteById query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Activate user
   */
  async activateById(userId) {
    try {
      return await User.findByIdAndUpdate(
        userId,
        { isActive: true },
        { new: true }
      );
    } catch (error) {
      logger.error(`Error in activateById query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all users with pagination
   */
  async findAll(page = 1, limit = 10, filters = {}) {
    try {
      const skip = (page - 1) * limit;
      
      const users = await User.find(filters)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .select('-password');

      const total = await User.countDocuments(filters);

      return {
        users,
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
   * Get active users count
   */
  async getActiveUsersCount() {
    try {
      return await User.countDocuments({ isActive: true });
    } catch (error) {
      logger.error(`Error in getActiveUsersCount query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search users by name or email
   */
  async searchUsers(searchTerm, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const searchRegex = new RegExp(searchTerm, 'i');
      const filters = {
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { username: searchRegex }
        ]
      };

      const users = await User.find(filters)
        .skip(skip)
        .limit(limit)
        .select('-password');

      const total = await User.countDocuments(filters);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error in searchUsers query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get users by role
   */
  async findByRole(role, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const users = await User.find({ role })
        .skip(skip)
        .limit(limit)
        .select('-password');

      const total = await User.countDocuments({ role });

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`Error in findByRole query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId, preferences) {
    try {
      return await User.findByIdAndUpdate(
        userId,
        { $set: { preferences } },
        { new: true }
      );
    } catch (error) {
      logger.error(`Error in updatePreferences query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bulk update users
   */
  async bulkUpdate(filter, updateData) {
    try {
      return await User.updateMany(filter, { $set: updateData });
    } catch (error) {
      logger.error(`Error in bulkUpdate query: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats() {
    try {
      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ isActive: true });
      const inactiveUsers = await User.countDocuments({ isActive: false });
      const adminUsers = await User.countDocuments({ role: 'admin' });

      return {
        totalUsers,
        activeUsers,
        inactiveUsers,
        adminUsers,
        regularUsers: totalUsers - adminUsers
      };
    } catch (error) {
      logger.error(`Error in getUserStats query: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new UserQueries();