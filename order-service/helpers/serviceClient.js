const axios = require('axios');
const logger = require('../utils/logger');

// Configuration from environment
const SERVICE_CALL_TIMEOUT = parseInt(process.env.SERVICE_CALL_TIMEOUT) || 5000;
const SERVICE_CALL_RETRIES = parseInt(process.env.SERVICE_CALL_RETRIES) || 3;
const SERVICE_CALL_RETRY_DELAY = parseInt(process.env.SERVICE_CALL_RETRY_DELAY) || 1000;

// Circuit Breaker configuration
const CIRCUIT_BREAKER_THRESHOLD = parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD) || 5;
const CIRCUIT_BREAKER_TIMEOUT = parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT) || 60000; // 60 seconds
const CIRCUIT_BREAKER_RESET_TIMEOUT = parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT) || 30000; // 30 seconds

/**
 * Circuit Breaker States
 */
const CircuitState = {
  CLOSED: 'CLOSED',     // Normal operation
  OPEN: 'OPEN',         // Circuit is open, reject requests
  HALF_OPEN: 'HALF_OPEN' // Testing if service recovered
};

/**
 * Circuit Breaker implementation for service calls
 */
class CircuitBreaker {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    
    // Configuration
    this.threshold = options.threshold || CIRCUIT_BREAKER_THRESHOLD;
    this.timeout = options.timeout || CIRCUIT_BREAKER_TIMEOUT;
    this.resetTimeout = options.resetTimeout || CIRCUIT_BREAKER_RESET_TIMEOUT;
    
    logger.info(`Circuit breaker initialized for ${serviceName}`);
  }

  /**
   * Check if circuit breaker allows the request
   */
  canRequest() {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // Check if it's time to try again
      if (Date.now() >= this.nextAttempt) {
        logger.info(`Circuit breaker for ${this.serviceName} entering HALF_OPEN state`);
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        return true;
      }
      return false;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      return true;
    }

    return false;
  }

  /**
   * Record successful request
   */
  recordSuccess() {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      // Require multiple successes to fully close circuit
      if (this.successCount >= 2) {
        logger.info(`Circuit breaker for ${this.serviceName} closing after successful recovery`);
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  /**
   * Record failed request
   */
  recordFailure() {
    this.failureCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      logger.warn(`Circuit breaker for ${this.serviceName} reopening after failed attempt`);
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.resetTimeout;
      return;
    }

    if (this.failureCount >= this.threshold) {
      logger.error(`Circuit breaker for ${this.serviceName} opening after ${this.failureCount} failures`);
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
  }

  /**
   * Get current state info
   */
  getState() {
    return {
      serviceName: this.serviceName,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttemptIn: this.state === CircuitState.OPEN 
        ? Math.max(0, this.nextAttempt - Date.now()) 
        : 0
    };
  }

  /**
   * Reset circuit breaker (for testing or manual reset)
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    logger.info(`Circuit breaker for ${this.serviceName} manually reset`);
  }
}

/**
 * Service Client with circuit breaker and retry logic
 */
class ServiceClient {
  constructor() {
    this.circuitBreakers = new Map();
    
    // Configure axios defaults
    this.axiosConfig = {
      timeout: SERVICE_CALL_TIMEOUT,
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }

  /**
   * Get or create circuit breaker for a service
   */
  getCircuitBreaker(serviceName) {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, new CircuitBreaker(serviceName));
    }
    return this.circuitBreakers.get(serviceName);
  }

  /**
   * Retry logic with exponential backoff
   */
  async retryWithBackoff(fn, serviceName, retries = SERVICE_CALL_RETRIES, delay = SERVICE_CALL_RETRY_DELAY) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await fn();
        return result;
      } catch (error) {
        const isLastAttempt = attempt === retries;
        
        // Don't retry on 4xx errors (client errors)
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          logger.warn(`[${serviceName}] Client error ${error.response.status}, not retrying`);
          throw error;
        }

        if (isLastAttempt) {
          logger.error(`[${serviceName}] Request failed after ${retries} attempts`);
          throw error;
        }

        // Exponential backoff
        const backoffDelay = delay * Math.pow(2, attempt - 1);
        logger.warn(`[${serviceName}] Attempt ${attempt} failed, retrying in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }

  /**
   * Make HTTP request with circuit breaker and retry logic
   */
  async request(serviceName, method, url, options = {}) {
    const circuitBreaker = this.getCircuitBreaker(serviceName);

    // Check circuit breaker
    if (!circuitBreaker.canRequest()) {
      const state = circuitBreaker.getState();
      const error = new Error(`Circuit breaker is OPEN for ${serviceName}. Retry in ${Math.ceil(state.nextAttemptIn / 1000)}s`);
      error.code = 'CIRCUIT_OPEN';
      error.circuitState = state;
      throw error;
    }

    try {
      // Make request with retry logic
      const response = await this.retryWithBackoff(async () => {
        const config = {
          ...this.axiosConfig,
          method,
          url,
          ...options
        };

        return await axios(config);
      }, serviceName);

      // Record success
      circuitBreaker.recordSuccess();
      return response;

    } catch (error) {
      // Record failure
      circuitBreaker.recordFailure();
      
      // Enhance error with circuit breaker info
      error.circuitBreakerState = circuitBreaker.getState();
      throw error;
    }
  }

  /**
   * Convenience method for GET requests
   */
  async get(serviceName, url, options = {}) {
    return this.request(serviceName, 'GET', url, options);
  }

  /**
   * Convenience method for POST requests
   */
  async post(serviceName, url, data, options = {}) {
    return this.request(serviceName, 'POST', url, { ...options, data });
  }

  /**
   * Convenience method for PUT requests
   */
  async put(serviceName, url, data, options = {}) {
    return this.request(serviceName, 'PUT', url, { ...options, data });
  }

  /**
   * Convenience method for DELETE requests
   */
  async delete(serviceName, url, options = {}) {
    return this.request(serviceName, 'DELETE', url, options);
  }

  /**
   * Convenience method for PATCH requests
   */
  async patch(serviceName, url, data, options = {}) {
    return this.request(serviceName, 'PATCH', url, { ...options, data });
  }

  /**
   * Get all circuit breaker states
   */
  getCircuitBreakerStates() {
    const states = {};
    this.circuitBreakers.forEach((breaker, serviceName) => {
      states[serviceName] = breaker.getState();
    });
    return states;
  }

  /**
   * Reset specific circuit breaker
   */
  resetCircuitBreaker(serviceName) {
    const breaker = this.circuitBreakers.get(serviceName);
    if (breaker) {
      breaker.reset();
      return true;
    }
    return false;
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers() {
    this.circuitBreakers.forEach(breaker => breaker.reset());
    logger.info('All circuit breakers reset');
  }

  /**
   * Health check for a service
   */
  async healthCheck(serviceName, url) {
    try {
      const response = await axios.get(url, { 
        timeout: 2000,
        headers: { 'X-Health-Check': 'true' }
      });
      return {
        serviceName,
        status: 'healthy',
        responseTime: response.headers['x-response-time'] || 'N/A',
        circuitBreaker: this.getCircuitBreaker(serviceName).getState()
      };
    } catch (error) {
      return {
        serviceName,
        status: 'unhealthy',
        error: error.message,
        circuitBreaker: this.getCircuitBreaker(serviceName).getState()
      };
    }
  }
}

// Export singleton instance
const serviceClient = new ServiceClient();

module.exports = {
  serviceClient,
  CircuitBreaker,
  CircuitState
};