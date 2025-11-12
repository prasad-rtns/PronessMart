const { serviceClient } = require('../helpers/serviceClient');
const { getCacheStats } = require('../middlewares/authMiddleware');
const logger = require('../utils/logger');

/**
 * Get version from package.json safely
 */
function getVersion() {
  try {
    const packageJson = require('../package.json');
    return packageJson.version || '1.0.0';
  } catch (error) {
    return '1.0.0';
  }
}

/**
 * Basic health check endpoint
 */
exports.healthCheck = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      status: 'healthy',
      service: process.env.SERVICE_NAME || 'order-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: getVersion()
    });
  } catch (error) {
    logger.error(`Health check error: ${error.message}`);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
};

/**
 * Detailed health check with circuit breaker states
 */
exports.healthCheckDetailed = async (req, res) => {
  try {
    const circuitBreakers = serviceClient.getCircuitBreakerStates();
    const authCache = getCacheStats();

    // Determine overall health
    let overallStatus = 'healthy';
    const openCircuits = Object.values(circuitBreakers).filter(
      cb => cb.state === 'OPEN'
    );
    
    if (openCircuits.length > 0) {
      overallStatus = 'degraded';
    }

    const health = {
      success: true,
      status: overallStatus,
      service: process.env.SERVICE_NAME || 'order-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      circuitBreakers: circuitBreakers,
      authCache: authCache,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT
      }
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error(`Detailed health check error: ${error.message}`);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
};

/**
 * Get circuit breaker states
 */
exports.getCircuitBreakers = async (req, res) => {
  try {
    const states = serviceClient.getCircuitBreakerStates();
    
    res.status(200).json({
      success: true,
      data: states,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Get circuit breakers error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get circuit breaker states',
      error: error.message
    });
  }
};

/**
 * Reset specific circuit breaker (admin only)
 */
exports.resetCircuitBreaker = async (req, res) => {
  try {
    const { serviceName } = req.params;

    if (!serviceName) {
      return res.status(400).json({
        success: false,
        message: 'Service name is required'
      });
    }

    const result = serviceClient.resetCircuitBreaker(serviceName);

    if (result) {
      logger.info(`Circuit breaker reset for ${serviceName} by user ${req.user?.id}`);
      res.status(200).json({
        success: true,
        message: `Circuit breaker reset for ${serviceName}`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Circuit breaker not found for service: ${serviceName}`
      });
    }
  } catch (error) {
    logger.error(`Reset circuit breaker error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to reset circuit breaker',
      error: error.message
    });
  }
};

/**
 * Reset all circuit breakers (admin only)
 */
exports.resetAllCircuitBreakers = async (req, res) => {
  try {
    serviceClient.resetAllCircuitBreakers();
    
    logger.info(`All circuit breakers reset by user ${req.user?.id}`);
    
    res.status(200).json({
      success: true,
      message: 'All circuit breakers reset',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Reset all circuit breakers error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to reset circuit breakers',
      error: error.message
    });
  }
};

/**
 * Get authentication cache statistics
 */
exports.getAuthCacheStats = async (req, res) => {
  try {
    const stats = getCacheStats();
    
    res.status(200).json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Get auth cache stats error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get auth cache stats',
      error: error.message
    });
  }
};

/**
 * Readiness probe (for Kubernetes)
 */
exports.readinessProbe = async (req, res) => {
  try {
    // Check if critical dependencies are available
    const circuitBreakers = serviceClient.getCircuitBreakerStates();
    
    // Count circuits
    const totalCircuits = Object.keys(circuitBreakers).length;
    const openCircuits = Object.values(circuitBreakers).filter(
      cb => cb.state === 'OPEN'
    ).length;

    // Service is ready if:
    // 1. No circuit breakers exist yet (startup phase), OR
    // 2. Not all circuits are open (at least one service available)
    const isReady = totalCircuits === 0 || openCircuits < totalCircuits;

    if (isReady) {
      res.status(200).json({
        success: true,
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        success: false,
        status: 'not_ready',
        reason: 'All service circuits are open',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error(`Readiness probe error: ${error.message}`);
    res.status(503).json({
      success: false,
      status: 'not_ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Liveness probe (for Kubernetes)
 */
exports.livenessProbe = async (req, res) => {
  try {
    // Simple check - if we can respond, we're alive
    res.status(200).json({
      success: true,
      status: 'alive',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Liveness probe error: ${error.message}`);
    res.status(500).json({
      success: false,
      status: 'dead',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};