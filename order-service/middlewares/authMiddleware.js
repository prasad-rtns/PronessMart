const jwt = require('../utils/jwt');
const logger = require('../utils/logger');
const { serviceClient } = require('../helpers/serviceClient');

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';
const USER_SERVICE_NAME = 'user-service';

// Configuration
const AUTH_FALLBACK_ENABLED = process.env.AUTH_FALLBACK_ENABLED !== 'false'; // Default: true
const AUTH_CACHE_ENABLED = process.env.AUTH_CACHE_ENABLED !== 'false'; // Default: true
const AUTH_CACHE_TTL = parseInt(process.env.AUTH_CACHE_TTL) || 300; // 5 minutes

// In-memory cache for validated users (optional - use Redis in production)
const validationCache = new Map();

/**
 * Cache validated user temporarily
 */
function cacheValidatedUser(userId, userData, ttl = AUTH_CACHE_TTL) {
  if (!AUTH_CACHE_ENABLED) return;
  
  const expiresAt = Date.now() + (ttl * 1000);
  validationCache.set(userId, {
    data: userData,
    expiresAt
  });

  // Auto-cleanup after TTL
  setTimeout(() => {
    validationCache.delete(userId);
  }, ttl * 1000);
}

/**
 * Get cached user validation
 */
function getCachedValidation(userId) {
  if (!AUTH_CACHE_ENABLED) return null;

  const cached = validationCache.get(userId);
  if (!cached) return null;

  if (Date.now() > cached.expiresAt) {
    validationCache.delete(userId);
    return null;
  }

  return cached.data;
}

/**
 * Validate user with User Service
 */
async function validateWithUserService(token, decoded) {
  try {
    // Check cache first
    const cachedUser = getCachedValidation(decoded.id);
    if (cachedUser) {
      logger.debug(`Using cached validation for user ${decoded.id}`);
      return {
        success: true,
        user: cachedUser,
        source: 'cache'
      };
    }

    // Make request to user service with circuit breaker
    const response = await serviceClient.get(
      USER_SERVICE_NAME,
      `${USER_SERVICE_URL}/api/v1/auth/validate`,
      {
        headers: { 
          Authorization: `Bearer ${token}` 
        }
      }
    );

    if (response.data.success) {
      // Cache successful validation
      cacheValidatedUser(decoded.id, response.data.user);
      
      logger.info(`User ${decoded.id} validated successfully with user-service`);
      return {
        success: true,
        user: response.data.user,
        source: 'user-service'
      };
    } else {
      return {
        success: false,
        message: 'User validation failed',
        source: 'user-service'
      };
    }
  } catch (error) {
    // Handle different error scenarios
    if (error.code === 'CIRCUIT_OPEN') {
      logger.warn(`Circuit breaker OPEN for user-service: ${error.message}`);
      return {
        success: false,
        error: 'circuit_open',
        message: error.message,
        circuitState: error.circuitState,
        shouldFallback: true
      };
    }

    if (error.response) {
      // User service responded with error
      logger.error(`User service error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      return {
        success: false,
        error: 'service_error',
        status: error.response.status,
        message: error.response.data.message || 'User validation failed',
        shouldFallback: error.response.status >= 500
      };
    }

    if (error.code === 'ECONNABORTED') {
      // Timeout
      logger.error('User service timeout');
      return {
        success: false,
        error: 'timeout',
        message: 'User service timeout',
        shouldFallback: true
      };
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      // User service is down
      logger.warn('User service unavailable');
      return {
        success: false,
        error: 'unavailable',
        message: 'User service unavailable',
        shouldFallback: true
      };
    }

    // Other network errors
    logger.error(`User service network error: ${error.message}`);
    return {
      success: false,
      error: 'network_error',
      message: 'Unable to validate user',
      shouldFallback: true
    };
  }
}

/**
 * Fallback authentication using token data only
 */
function fallbackAuthentication(decoded) {
  logger.warn(`Using fallback authentication for user ${decoded.id}`);
  
  return {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
    // Add flag to indicate this is fallback auth
    _fallbackAuth: true,
    _validatedAt: new Date().toISOString()
  };
}

/**
 * Main authentication middleware
 */
const authMiddleware = async (req, res, next) => {
  const startTime = Date.now();

  try {
    // Extract token from header
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      logger.warn('No token provided in request');
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
        error: 'missing_token'
      });
    }

    try {
      // Step 1: Verify token signature locally (fast fail for invalid tokens)
      const decoded = jwt.verifyToken(token);
      logger.debug(`Token decoded successfully for user ${decoded.id}`);

      // Step 2: Validate with User service
      const validationResult = await validateWithUserService(token, decoded);

      if (validationResult.success) {
        // Successful validation
        req.user = validationResult.user;
        req.authSource = validationResult.source;
        
        const duration = Date.now() - startTime;
        logger.info(`Auth successful for user ${decoded.id} via ${validationResult.source} (${duration}ms)`);
        
        return next();
      }

      // Validation failed - check if we should use fallback
      if (validationResult.shouldFallback && AUTH_FALLBACK_ENABLED) {
        // Use token data as fallback
        req.user = fallbackAuthentication(decoded);
        req.authSource = 'fallback';
        req.authWarning = validationResult.message;
        
        const duration = Date.now() - startTime;
        logger.warn(`Auth using fallback for user ${decoded.id} (${duration}ms)`);
        
        return next();
      }

      // No fallback or validation failed without fallback option
      const status = validationResult.status || (validationResult.error === 'circuit_open' ? 503 : 401);
      return res.status(status).json({
        success: false,
        message: validationResult.message || 'Authentication failed',
        error: validationResult.error,
        ...(validationResult.circuitState && { circuitBreaker: validationResult.circuitState })
      });

    } catch (tokenError) {
      // Token verification failed
      logger.error(`Token verification error: ${tokenError.message}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        error: 'invalid_token'
      });
    }

  } catch (error) {
    // Unexpected error
    logger.error(`Auth middleware error: ${error.message}`, { stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: 'server_error'
    });
  }
};

/**
 * Optional middleware to require non-fallback authentication
 * Use this for sensitive operations that require full user validation
 */
const requireFullAuth = (req, res, next) => {
  if (req.user && req.user._fallbackAuth) {
    logger.warn(`Full auth required but fallback used for user ${req.user.id}`);
    return res.status(503).json({
      success: false,
      message: 'This operation requires full authentication. User service is currently unavailable.',
      error: 'full_auth_required'
    });
  }
  next();
};

/**
 * Admin role check middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    logger.warn(`User ${req.user.id} attempted admin access with role ${req.user.role}`);
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
      error: 'insufficient_permissions'
    });
  }

  next();
};

/**
 * Role-based access control middleware factory
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`User ${req.user.id} with role ${req.user.role} attempted access requiring roles: ${allowedRoles.join(', ')}`);
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        error: 'insufficient_permissions'
      });
    }

    next();
  };
};

/**
 * Clear validation cache (useful for testing or manual cache clear)
 */
function clearValidationCache(userId = null) {
  if (userId) {
    validationCache.delete(userId);
    logger.info(`Cleared validation cache for user ${userId}`);
  } else {
    validationCache.clear();
    logger.info('Cleared all validation cache');
  }
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  const now = Date.now();
  let active = 0;
  let expired = 0;

  validationCache.forEach((value) => {
    if (now > value.expiresAt) {
      expired++;
    } else {
      active++;
    }
  });

  return {
    total: validationCache.size,
    active,
    expired,
    cacheEnabled: AUTH_CACHE_ENABLED,
    cacheTTL: AUTH_CACHE_TTL
  };
}

module.exports = {
  authMiddleware,
  requireFullAuth,
  requireAdmin,
  requireRole,
  clearValidationCache,
  getCacheStats
};