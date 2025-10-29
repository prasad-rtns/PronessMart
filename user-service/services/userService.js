const userQueries = require('../data/userQueries');
const jwt = require('../utils/jwt');
const logger = require('../utils/logger');
const cache = require('../utils/cache');

class UserService {
  async registerUser(userData) {
    try {
      const { username, email, password } = userData;

      // Check if user already exists
      const existingUser = await userQueries.existsByEmailOrUsername(email, username);
      if (existingUser) {
        throw new Error('User with this email or username already exists');
      }

      // Create new user
      const user = await userQueries.create({
        username,
        email,
        password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        address: userData.address,
        role: userData.role
      });

      return user;
    } catch (error) {
      logger.error(`Error registering user: ${error.message}`);
      throw error;
    }
  }

  async loginUser(username, password) {
    try {
      // Find user by username or email
      const user = await userQueries.findByUsernameOrEmail(username);

      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Update last login
      await userQueries.updateLastLogin(user._id);

      // Generate token
      const token = await this.generateToken(user._id);

      // Remove password from response
      user.password = undefined;

      return { user, token };
    } catch (error) {
      logger.error(`Error logging in user: ${error.message}`);
      throw error;
    }
  }

  // async getUserById(userId) {
  //   try {
  //     return await userQueries.findById(userId);
  //   } catch (error) {
  //     logger.error(`Error getting user: ${error.message}`);
  //     throw error;
  //   }
  // }
  async getUserById(userId) {
      try {
        const cacheKey = `user:${userId}`;
        let user = await cache.getCache(cacheKey);
  
        if (user) {
            logger.info(`User ${userId} found in cache.`);
            return user;
        }
  
        user = await userQueries.findById(userId);
        return user;
      } catch (error) {
        logger.error(`Error getting user: ${error.message}`);
        throw error;
      }
    }

  async updateUser(userId, updateData) {
    try {
      // Remove sensitive fields that shouldn't be updated directly
      delete updateData.password;
      delete updateData.role;
      delete updateData.email;

      return await userQueries.updateById(userId, updateData);
    } catch (error) {
      logger.error(`Error updating user: ${error.message}`);
      throw error;
    }
  }

  async deleteUser(userId) {
    try {
      return await userQueries.deleteById(userId);
    } catch (error) {
      logger.error(`Error deleting user: ${error.message}`);
      throw error;
    }
  }

  async getAllUsers(page = 1, limit = 10) {
    try {
      return await userQueries.findAll(page, limit);
    } catch (error) {
      logger.error(`Error getting all users: ${error.message}`);
      throw error;
    }
  }

  async generateToken(userId) {
    return jwt.generateToken({ id: userId });
  }

  async verifyToken(token) {
    return jwt.verifyToken(token);
  }

  // userService.js - Add this method to your UserService class

async validateUser(userId) {
  try {
    const cacheKey = `user:${userId}`;
    let user = await cache.getCache(cacheKey);

    if (user) {
      logger.info(`User ${userId} found in cache for validation.`);
      return user;
    }

    user = await userQueries.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Cache the user data for 5 minutes
    await cache.setCache(cacheKey, user, 300);

    // Remove password before returning
    user.password = undefined;

    return user;
    } catch (error) {
      logger.error(`Error validating user: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new UserService();