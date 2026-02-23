# Circuit Breaker & Enhanced Auth Implementation Guide

## Overview

This implementation provides:
1. **Reusable ServiceClient** with circuit breaker and retry logic
2. **Enhanced Authentication Middleware** with fallback support
3. **Health Check Endpoints** for monitoring circuit breakers
4. **Shared utilities** to avoid code duplication

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Service Architecture                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Order Service                                                │
│  ├── authMiddleware (validates tokens)                       │
│  ├── orderService (business logic)                           │
│  └── serviceClient (shared HTTP client)                      │
│       ├── Circuit Breakers (per service)                     │
│       │   ├── user-service                                   │
│       │   ├── product-service                                │
│       │   └── cart-service                                   │
│       └── Retry Logic (exponential backoff)                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
order-service/
├── helpers/
│   └── serviceClient.js          # NEW - Shared HTTP client
├── middleware/
│   └── authMiddleware.js         # UPDATED - Enhanced auth
├── services/
│   └── orderService.js           # UPDATED - Uses serviceClient
├── controllers/
│   └── healthController.js       # NEW - Health endpoints
├── routes/
│   └── healthRoutes.js           # NEW - Health routes
└── .env                          # UPDATED - New config
```

## Installation Steps

### Step 1: Create Helper Directory and ServiceClient

Create `helpers/serviceClient.js` with the provided code.

### Step 2: Update Authentication Middleware

Replace `middleware/authMiddleware.js` with the enhanced version.

### Step 3: Update OrderService

Replace `services/orderService.js` with the version that uses serviceClient.

### Step 4: Create Health Check Components

Create:
- `controllers/healthController.js`
- `routes/healthRoutes.js`

### Step 5: Register Health Routes

In your main `app.js` or `server.js`:

```javascript
const healthRoutes = require('./routes/healthRoutes');

// Register health routes (before other routes)
app.use('/', healthRoutes);

// Your other routes...
app.use('/api/v1/orders', orderRoutes);
```

### Step 6: Update Environment Variables

Add to your `.env` file:

```bash
# Service Communication
SERVICE_CALL_TIMEOUT=5000
SERVICE_CALL_RETRIES=3
SERVICE_CALL_RETRY_DELAY=1000

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60000
CIRCUIT_BREAKER_RESET_TIMEOUT=30000

# Authentication
AUTH_FALLBACK_ENABLED=true
AUTH_CACHE_ENABLED=true
AUTH_CACHE_TTL=300
```

### Step 7: Apply to All Services

Repeat steps 1-6 for:
- user-service
- product-service
- cart-service

## How It Works

### Circuit Breaker States

```
CLOSED (Normal) ──[5 failures]──> OPEN (Rejecting)
     ^                                  │
     │                                  │
     └──[2 successes]─── HALF_OPEN <───┘
                          (Testing)
```

**CLOSED**: Normal operation, all requests allowed
- Tracks failure count
- Opens circuit after threshold reached

**OPEN**: Circuit is open, requests are rejected immediately
- Prevents cascading failures
- Saves resources by not making doomed requests
- Waits for reset timeout before trying again

**HALF_OPEN**: Testing if service recovered
- Allows limited requests through
- Closes on success, reopens on failure

### Authentication Flow

```
Request with Token
    │
    ├─> Verify Token Locally (JWT signature)
    │   ├─> Invalid? → 401 Unauthorized
    │   └─> Valid? → Continue
    │
    ├─> Check Cache
    │   ├─> Cached? → Use cached user
    │   └─> Not cached? → Validate with user-service
    │
    ├─> Call User Service (via Circuit Breaker)
    │   ├─> Success? → Cache & Allow
    │   ├─> Circuit OPEN? → Use fallback (if enabled)
    │   ├─> 4xx error? → Reject (don't retry)
    │   └─> 5xx error? → Retry with backoff
    │
    └─> Fallback Mode (if enabled & service unavailable)
        └─> Use token data (with warning flag)
```

## API Endpoints

### Public Endpoints (No Auth)

```bash
# Basic health check
GET /health

# Detailed health check with circuit breakers
GET /health/detailed

# Kubernetes probes
GET /health/live
GET /health/ready
```

### Protected Endpoints (Requires Auth)

```bash
# Get circuit breaker states
GET /health/circuit-breakers
Authorization: Bearer <token>

# Get auth cache stats (admin only)
GET /health/auth-cache
Authorization: Bearer <admin_token>
```

### Admin Endpoints

```bash
# Reset specific circuit breaker
POST /health/circuit-breakers/user-service/reset
Authorization: Bearer <admin_token>

# Reset all circuit breakers
POST /health/circuit-breakers/reset-all
Authorization: Bearer <admin_token>
```

## Usage Examples

### 1. Making Service Calls

```javascript
const { serviceClient } = require('../helpers/serviceClient');

// Simple GET request
const response = await serviceClient.get(
  'product-service',
  'http://product-service:3002/api/v1/products/123'
);

// POST with data
const response = await serviceClient.post(
  'cart-service',
  'http://cart-service:3003/api/v1/cart/items',
  { productId: '123', quantity: 2 },
  { headers: { 'Authorization': `Bearer ${token}` } }
);
```

### 2. Handling Circuit Breaker Errors

```javascript
try {
  const product = await serviceClient.get(
    'product-service',
    `${PRODUCT_SERVICE_URL}/api/v1/products/${id}`
  );
  return product.data;
} catch (error) {
  if (error.code === 'CIRCUIT_OPEN') {
    // Circuit is open - return cached data or fail gracefully
    logger.warn('Circuit breaker open, using cached data');
    return getCachedProduct(id);
  }
  throw error;
}
```

### 3. Authentication with Fallback

```javascript
// In your routes
router.post('/orders', authMiddleware, createOrder);

// The middleware will:
// 1. Try to validate with user-service
// 2. If user-service is down, use fallback (token data)
// 3. req.user will have _fallbackAuth flag if using fallback

// For sensitive operations, require full auth
router.delete('/orders/:id', 
  authMiddleware, 
  requireFullAuth,  // Rejects fallback auth
  deleteOrder
);
```

### 4. Monitoring Circuit Breakers

```bash
# Check service health
curl http://localhost:3004/health/detailed

# Response
{
  "success": true,
  "status": "degraded",
  "circuitBreakers": {
    "user-service": {
      "state": "OPEN",
      "failureCount": 5,
      "nextAttemptIn": 45000
    },
    "product-service": {
      "state": "CLOSED",
      "failureCount": 0
    },
    "cart-service": {
      "state": "HALF_OPEN",
      "successCount": 1
    }
  }
}
```

### 5. Manual Circuit Breaker Reset

```bash
# Reset specific circuit breaker (admin only)
curl -X POST http://localhost:3004/health/circuit-breakers/user-service/reset \
  -H "Authorization: Bearer <admin_token>"

# Reset all circuit breakers (admin only)
curl -X POST http://localhost:3004/health/circuit-breakers/reset-all \
  -H "Authorization: Bearer <admin_token>"
```

## Configuration Options

### Circuit Breaker Configuration

```bash
# Number of failures before opening circuit
CIRCUIT_BREAKER_THRESHOLD=5

# How long circuit stays open (ms)
CIRCUIT_BREAKER_TIMEOUT=60000

# How long to wait before testing recovery (ms)
CIRCUIT_BREAKER_RESET_TIMEOUT=30000
```

### Retry Configuration

```bash
# Request timeout (ms)
SERVICE_CALL_TIMEOUT=5000

# Number of retry attempts
SERVICE_CALL_RETRIES=3

# Initial retry delay (ms) - uses exponential backoff
SERVICE_CALL_RETRY_DELAY=1000
```

### Authentication Configuration

```bash
# Enable fallback auth when user-service is down
AUTH_FALLBACK_ENABLED=true

# Enable validation caching
AUTH_CACHE_ENABLED=true

# Cache TTL in seconds
AUTH_CACHE_TTL=300
```

## Best Practices

### 1. Service Naming Convention

Always use consistent service names:
```javascript
const CART_SERVICE_NAME = 'cart-service';
const PRODUCT_SERVICE_NAME = 'product-service';
const USER_SERVICE_NAME = 'user-service';
```

### 2. Error Handling

```javascript
try {
  const result = await serviceClient.get(serviceName, url);
  return result.data;
} catch (error) {
  if (error.code === 'CIRCUIT_OPEN') {
    // Handle circuit open gracefully
    return handleFallback();
  }
  if (error.response?.status === 404) {
    // Handle not found
    throw new NotFoundError();
  }
  // Other errors
  throw error;
}
```

### 3. Graceful Degradation

```javascript
// Try service call, fallback to cache
async function getProduct(productId) {
  try {
    return await fetchFromService(productId);
  } catch (error) {
    if (error.code === 'CIRCUIT_OPEN') {
      logger.warn('Using cached product data');
      return await getCachedProduct(productId);
    }
    throw error;
  }
}
```

### 4. Monitoring and Alerting

Set up alerts for:
- Circuit breaker state changes
- High failure rates
- Circuit breakers staying open for extended periods

```javascript
// Log circuit breaker state changes
const breaker = serviceClient.getCircuitBreaker('product-service');
if (breaker.state === 'OPEN') {
  logger.error('Product service circuit breaker opened!', {
    failureCount: breaker.failureCount,
    nextAttempt: breaker.nextAttempt
  });
  // Send alert to monitoring system
  sendAlert('CIRCUIT_BREAKER_OPEN', { service: 'product-service' });
}
```

### 5. Testing Circuit Breakers

```javascript
// In your tests
const { serviceClient } = require('../helpers/serviceClient');

describe('Circuit Breaker', () => {
  beforeEach(() => {
    serviceClient.resetAllCircuitBreakers();
  });

  it('should open circuit after threshold failures', async () => {
    // Simulate failures
    for (let i = 0; i < 5; i++) {
      try {
        await serviceClient.get('test-service', 'http://invalid-url');
      } catch (error) {
        // Expected to fail
      }
    }

    // Circuit should be open now
    const state = serviceClient
      .getCircuitBreaker('test-service')
      .getState();
    
    expect(state.state).toBe('OPEN');
  });
});
```

## Troubleshooting

### Circuit Breaker Stuck Open

**Symptom**: Circuit breaker stays OPEN even after service recovers

**Solution**:
```bash
# Manual reset via API
curl -X POST http://localhost:3004/health/circuit-breakers/service-name/reset \
  -H "Authorization: Bearer <admin_token>"

# Or restart the service
docker compose restart order-service
```

### High Cache Miss Rate

**Symptom**: Too many calls to user-service for validation

**Solution**:
```bash
# Increase cache TTL
AUTH_CACHE_TTL=600  # 10 minutes instead of 5
```

### Fallback Auth Not Working

**Symptom**: Requests fail even with fallback enabled

**Solution**:
```bash
# Ensure fallback is enabled
AUTH_FALLBACK_ENABLED=true

# Check if requireFullAuth middleware is blocking fallback
# Remove requireFullAuth for non-critical endpoints
```

### Service Always Timing Out

**Symptom**: Requests consistently timeout

**Solution**:
```bash
# Increase timeout
SERVICE_CALL_TIMEOUT=10000  # 10 seconds

# Or check service health
docker compose logs product-service
```

## Performance Optimization

### 1. Connection Pooling

```javascript
// Add to serviceClient.js constructor
const http = require('http');
const https = require('https');

this.httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 50
});

this.httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50
});

// Use in axios config
axios.defaults.httpAgent = this.httpAgent;
axios.defaults.httpsAgent = this.httpsAgent;
```

### 2. Request Batching

```javascript
// Batch multiple product requests
async function getProductsBatch(productIds) {
  const requests = productIds.map(id =>
    serviceClient.get('product-service', `${URL}/products/${id}`)
  );
  return Promise.all(requests);
}
```

### 3. Redis Cache for Validation

Replace in-memory cache with Redis:

```javascript
const redis = require('redis');
const client = redis.createClient();

async function cacheValidatedUser(userId, userData, ttl) {
  await client.setex(
    `auth:${userId}`,
    ttl,
    JSON.stringify(userData)
  );
}

async function getCachedValidation(userId) {
  const data = await client.get(`auth:${userId}`);
  return data ? JSON.parse(data) : null;
}
```

## Metrics to Monitor

1. **Circuit Breaker Metrics**
   - State changes (CLOSED → OPEN → HALF_OPEN)
   - Time spent in each state
   - Number of rejected requests

2. **Request Metrics**
   - Success rate
   - Response time
   - Retry count
   - Timeout rate

3. **Authentication Metrics**
   - Cache hit rate
   - Fallback usage rate
   - Validation latency

4. **Service Health**
   - Service availability
   - Error rates by service
   - Circuit breaker states

## Summary

✅ **Benefits:**
- Automatic failure handling
- Prevents cascading failures
- Graceful degradation
- Reduced code duplication
- Better observability
- Improved reliability

✅ **Features:**
- Circuit breaker per service
- Exponential backoff retry
- Authentication caching
- Fallback authentication
- Health monitoring endpoints
- Admin controls

✅ **Production Ready:**
- Comprehensive error handling
- Detailed logging
- Monitoring endpoints
- Configuration via environment
- Role-based access control