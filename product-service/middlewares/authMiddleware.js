const jwt = require('../utils/jwt');
const logger = require('../utils/logger');
const axios = require('axios');

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token signature locally first (fast fail for invalid tokens)
      const decoded = jwt.verifyToken(token);

      // Validate with User service to check user status
      try {
        const response = await axios.get(`${USER_SERVICE_URL}/api/v1/auth/validate`, {
          headers: { 
            Authorization: `Bearer ${token}` 
          },
          timeout: 5000 // 5 second timeout
        });

        if (response.data.success) {
          req.user = response.data.user;
          next();
        } else {
          return res.status(401).json({
            success: false,
            message: 'User validation failed'
          });
        }
      } catch (apiError) {
        // Handle User service errors
        if (apiError.response) {
          // User service responded with error
          logger.error(`User service error: ${apiError.response.status} - ${apiError.response.data.message}`);
          return res.status(apiError.response.status).json({
            success: false,
            message: apiError.response.data.message || 'User validation failed'
          });
        } else if (apiError.code === 'ECONNABORTED') {
          // Timeout
          logger.error('User service timeout');
          return res.status(503).json({
            success: false,
            message: 'User service timeout'
          });
        } else if (apiError.code === 'ECONNREFUSED') {
          // User service is down - fallback to token data
          logger.warn('User service unavailable, using token data as fallback');
          req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role
          };
          next();
        } else {
          // Other network errors
          logger.error(`User service network error: ${apiError.message}`);
          return res.status(503).json({
            success: false,
            message: 'Unable to validate user'
          });
        }
      }
    } catch (error) {
      logger.error(`Token verification error: ${error.message}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = authMiddleware;