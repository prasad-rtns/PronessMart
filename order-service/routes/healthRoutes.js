const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');
const { authMiddleware, requireAdmin } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Health & Monitoring
 *   description: Service health checks, circuit breaker monitoring, and system diagnostics
 */

/**
 * @swagger
 * /api/v1/orders/health/healthCheck:
 *   get:
 *     summary: Basic health check
 *     tags: [Health & Monitoring]
 *     description: Returns basic service health status including uptime, memory usage, and service version
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             example:
 *               success: true
 *               status: "healthy"
 *               service: "order-service"
 *               timestamp: "2025-01-15T10:30:00.000Z"
 *               uptime: 3600.5
 *               memory:
 *                 rss: 52428800
 *                 heapTotal: 18874368
 *                 heapUsed: 12345678
 *                 external: 1234567
 *               version: "1.0.0"
 *       500:
 *         description: Service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/healthCheck', healthController.healthCheck);

/**
 * @swagger
 * /api/v1/orders/health/detailed:
 *   get:
 *     summary: Detailed health check with circuit breaker states
 *     tags: [Health & Monitoring]
 *     description: Returns comprehensive health information including circuit breaker states, authentication cache stats, and system metrics
 *     responses:
 *       200:
 *         description: Detailed health information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DetailedHealthResponse'
 *       503:
 *         description: Service is degraded (some circuit breakers are open)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DetailedHealthResponse'
 *             example:
 *               success: true
 *               status: "degraded"
 *               service: "order-service"
 *               timestamp: "2025-01-15T10:30:00.000Z"
 *               uptime: 3600.5
 *               circuitBreakers:
 *                 user-service:
 *                   serviceName: "user-service"
 *                   state: "OPEN"
 *                   failureCount: 5
 *                   successCount: 0
 *                   nextAttemptIn: 45000
 *                 product-service:
 *                   serviceName: "product-service"
 *                   state: "CLOSED"
 *                   failureCount: 0
 *                   successCount: 0
 *                   nextAttemptIn: 0
 */
router.get('/detailed', healthController.healthCheckDetailed);

/**
 * @swagger
 * /api/v1/orders/health/live:
 *   get:
 *     summary: Kubernetes liveness probe
 *     tags: [Health & Monitoring]
 *     description: Simple endpoint to check if the service is alive. Used by Kubernetes for container restart decisions.
 *     responses:
 *       200:
 *         description: Service is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: string
 *                   example: "alive"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Service is not responsive
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/live', healthController.livenessProbe);

/**
 * @swagger
 * /api/v1/orders/health/ready:
 *   get:
 *     summary: Kubernetes readiness probe
 *     tags: [Health & Monitoring]
 *     description: Checks if the service is ready to accept traffic. Returns 503 if critical dependencies are unavailable.
 *     responses:
 *       200:
 *         description: Service is ready to accept traffic
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: string
 *                   example: "ready"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       503:
 *         description: Service is not ready (dependencies unavailable)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: string
 *                   example: "not_ready"
 *                 reason:
 *                   type: string
 *                   example: "All service circuits are open"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/ready', healthController.readinessProbe);

/**
 * @swagger
 * /api/v1/orders/health/circuit-breakers:
 *   get:
 *     summary: Get all circuit breaker states
 *     tags: [Health & Monitoring]
 *     description: Returns the current state of all circuit breakers for dependent services
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Circuit breaker states retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CircuitBreakersResponse'
 *             example:
 *               success: true
 *               data:
 *                 user-service:
 *                   serviceName: "user-service"
 *                   state: "CLOSED"
 *                   failureCount: 0
 *                   successCount: 0
 *                   nextAttemptIn: 0
 *                 product-service:
 *                   serviceName: "product-service"
 *                   state: "OPEN"
 *                   failureCount: 5
 *                   successCount: 0
 *                   nextAttemptIn: 45000
 *                 cart-service:
 *                   serviceName: "cart-service"
 *                   state: "HALF_OPEN"
 *                   failureCount: 0
 *                   successCount: 1
 *                   nextAttemptIn: 0
 *               timestamp: "2025-01-15T10:30:00.000Z"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/circuit-breakers', authMiddleware, healthController.getCircuitBreakers);

/**
 * @swagger
 * /api/v1/orders/health/circuit-breakers/{serviceName}/reset:
 *   post:
 *     summary: Reset specific circuit breaker
 *     tags: [Health & Monitoring]
 *     description: Manually reset a circuit breaker for a specific service (Admin only). Useful when a service has recovered but the circuit is still open.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceName
 *         required: true
 *         schema:
 *           type: string
 *           enum: [user-service, product-service, cart-service]
 *         description: Name of the service whose circuit breaker should be reset
 *         example: user-service
 *     responses:
 *       200:
 *         description: Circuit breaker reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Circuit breaker reset for user-service"
 *               timestamp: "2025-01-15T10:30:00.000Z"
 *       400:
 *         description: Service name is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Admin access required"
 *               error: "insufficient_permissions"
 *       404:
 *         description: Circuit breaker not found for the specified service
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Circuit breaker not found for service: invalid-service"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/circuit-breakers/:serviceName/reset', 
  authMiddleware, 
  requireAdmin, 
  healthController.resetCircuitBreaker
);

/**
 * @swagger
 * /api/v1/orders/health/circuit-breakers/reset-all:
 *   post:
 *     summary: Reset all circuit breakers
 *     tags: [Health & Monitoring]
 *     description: Manually reset all circuit breakers for all services (Admin only). Use with caution - only reset when you're certain services have recovered.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All circuit breakers reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "All circuit breakers reset"
 *               timestamp: "2025-01-15T10:30:00.000Z"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/circuit-breakers/reset-all', 
  authMiddleware, 
  requireAdmin, 
  healthController.resetAllCircuitBreakers
);

/**
 * @swagger
 * /api/v1/orders/health/auth-cache:
 *   get:
 *     summary: Get authentication cache statistics
 *     tags: [Health & Monitoring]
 *     description: Returns statistics about the authentication cache including total entries, active entries, and cache configuration (Admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Auth cache statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthCacheStatsResponse'
 *             example:
 *               success: true
 *               data:
 *                 total: 150
 *                 active: 142
 *                 expired: 8
 *                 cacheEnabled: true
 *                 cacheTTL: 300
 *               timestamp: "2025-01-15T10:30:00.000Z"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/auth-cache', 
  authMiddleware, 
  requireAdmin, 
  healthController.getAuthCacheStats
);

module.exports = router;