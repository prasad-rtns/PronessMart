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
    //logger.info(`authMiddleware:user-token ${token} found.`);
    //logger.info(`authMiddleware:user-decoded ${JSON.stringify(decoded)} found.`);
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

/**
 * Middleware to authorize access based on user roles and a defined role hierarchy.
 * @param {string[]} rolesAllowed - An array of roles that are allowed to access the resource.
 */
const authorizeRoles = (rolesAllowed = []) => {
  return (req, res, next) => {
    if (rolesAllowed.length === 0) {
      if (!req.user || !req.user.id) {
        logger.warn('Authorization attempt for unauthenticated user on route with no specific roles.');
        return res.status(401).json({ message: 'Unauthorized: Authentication required' });
      }
      return next();
    }
    
    if (!req.user || !req.user.role) {
      logger.warn('Authorization attempt without user role attached to request.');
      return res.status(401).json({ message: 'Unauthorized: User role not found' });
    }
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

      // Verify token signature locally first (fast fail for invalid tokens)
    const decoded = jwt.verifyToken(token);
  
    const userRole = decoded.role; 
    const userHasRequiredRole = (currentRole, requiredRoles) => {
      return requiredRoles.includes(currentRole);
    };

    if (userHasRequiredRole(userRole, rolesAllowed)) {
      return next();
    }

    logger.warn(`Forbidden: User with role '${userRole}' tried to access a resource requiring roles: ${rolesAllowed.join(', ')}`);
    return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
  };
};

module.exports = {
  authMiddleware,
  authorizeRoles
};