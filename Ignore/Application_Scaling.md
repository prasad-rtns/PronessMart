# Service Scaling Implementation Guide

## Overview
This guide explains how to handle cross-service communication in a scaled microservices architecture using Docker's built-in DNS load balancing.

## How Docker DNS Load Balancing Works

When you scale a service (e.g., `user-service`) to 3 instances:
- Docker creates 3 containers: `user-service-1`, `user-service-2`, `user-service-3`
- All containers share the same service name: `user-service`
- Docker's internal DNS automatically **round-robins** requests across all instances
- No additional load balancer needed!

## Key Changes Made

### 1. Environment Configuration (.env)

**Changed:**
```bash
# OLD (hardcoded localhost)
CART_SERVICE_URL=http://localhost:3003

# NEW (Docker service name)
CART_SERVICE_URL=http://cart-service:3003
```

**Why:** Docker's DNS resolver automatically distributes requests across all scaled instances of `cart-service`.

### 2. Enhanced Error Handling (orderService.js)

Added three critical features:

#### A. Retry Logic with Exponential Backoff
```javascript
async retryServiceCall(serviceCall, retries = 3, delay = 1000) {
  // Retries failed requests with increasing delays
  // 1st retry: 1s, 2nd: 2s, 3rd: 4s
}
```

#### B. Smart Retry Strategy
- **Retries 5xx errors** (server errors) - might succeed on different instance
- **Does NOT retry 4xx errors** (client errors) - will fail on any instance
- **Timeout handling** - fails fast if service is down

#### C. Parallel Product Validation
```javascript
// Validates all products simultaneously for better performance
const validations = await Promise.all(validationPromises);
```

## Implementation Steps

### Step 1: Update All Service .env Files

Create/update `.env` in each service directory:

**user-service/.env:**
```bash
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://mongo-user:27017/userdb
REDIS_HOST=redis
REDIS_PORT=6379
JWT_SECRET=D8xR6OwlWftxzw7BLPY1N/GLEgAAK3xOYt+HCZMglL8=

# Service URLs (Docker DNS handles load balancing)
PRODUCT_SERVICE_URL=http://product-service:3002
CART_SERVICE_URL=http://cart-service:3003
ORDER_SERVICE_URL=http://order-service:3004

# Kafka
KAFKA_BROKERS=kafka-1:29092,kafka-2:29093,kafka-3:29094
ENABLE_KAFKA=true
```

**product-service/.env:**
```bash
NODE_ENV=production
PORT=3002
MONGODB_URI=mongodb://mongo-product:27017/productdb
REDIS_HOST=redis
REDIS_PORT=6379
JWT_SECRET=D8xR6OwlWftxzw7BLPY1N/GLEgAAK3xOYt+HCZMglL8=

# Service URLs
USER_SERVICE_URL=http://user-service:3001
CART_SERVICE_URL=http://cart-service:3003
ORDER_SERVICE_URL=http://order-service:3004

# Kafka
KAFKA_BROKERS=kafka-1:29092,kafka-2:29093,kafka-3:29094
ENABLE_KAFKA=true
```

**cart-service/.env:**
```bash
NODE_ENV=production
PORT=3003
MONGODB_URI=mongodb://mongo-cart:27017/cartdb
REDIS_HOST=redis
REDIS_PORT=6379
JWT_SECRET=D8xR6OwlWftxzw7BLPY1N/GLEgAAK3xOYt+HCZMglL8=

# Service URLs
USER_SERVICE_URL=http://user-service:3001
PRODUCT_SERVICE_URL=http://product-service:3002
ORDER_SERVICE_URL=http://order-service:3004

# Kafka
KAFKA_BROKERS=kafka-1:29092,kafka-2:29093,kafka-3:29094
ENABLE_KAFKA=true
```

**order-service/.env:**
```bash
NODE_ENV=production
PORT=3004
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_DATABASE=orderdb
MYSQL_USER=root
MYSQL_PASSWORD=8f8z/8zXt9LcnykJUvXTFQ==

JWT_SECRET=D8xR6OwlWftxzw7BLPY1N/GLEgAAK3xOYt+HCZMglL8=

# Service URLs
USER_SERVICE_URL=http://user-service:3001
PRODUCT_SERVICE_URL=http://product-service:3002
CART_SERVICE_URL=http://cart-service:3003

# Kafka
KAFKA_BROKERS=kafka-1:29092,kafka-2:29093,kafka-3:29094
ENABLE_KAFKA=true

# Service call configuration
SERVICE_CALL_TIMEOUT=5000
SERVICE_CALL_RETRIES=3
SERVICE_CALL_RETRY_DELAY=1000
```

### Step 2: Apply Enhanced orderService.js

Replace the existing `order-service/services/orderService.js` with the enhanced version provided above.

### Step 3: Apply Similar Pattern to Other Services

Apply the same retry logic pattern to other services (user-service, product-service, cart-service) when they make HTTP calls to other services.

**Example for cart-service:**
```javascript
// cart-service/services/cartService.js
async validateProduct(productId) {
  return this.retryServiceCall(async () => {
    const response = await axios.get(
      `${PRODUCT_SERVICE_URL}/api/v1/products/${productId}`,
      { timeout: 5000 }
    );
    return response.data;
  });
}
```

### Step 4: Deploy with Scaling

```bash
# Build all services
docker compose build

# Start with 3 instances of each service
docker compose up -d \
  --scale api-gateway=3 \
  --scale user-service=3 \
  --scale product-service=3 \
  --scale cart-service=3 \
  --scale order-service=3

# Verify all instances are running
docker compose ps
```

### Step 5: Test Load Distribution

```bash
# Monitor logs from all order-service instances
docker compose logs -f order-service

# Make multiple API calls and observe round-robin distribution
curl -X POST http://localhost:8090/api/v1/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "123", "cartId": "456", ...}'

# You should see logs from different instances handling requests
```

## Monitoring and Debugging

### Check Service Instance Distribution

```bash
# See all running instances
docker compose ps | grep service

# Expected output:
# order-service-1
# order-service-2
# order-service-3
# product-service-1
# product-service-2
# ...
```

### Monitor Specific Service Logs

```bash
# All instances of a service
docker compose logs -f order-service

# Specific instance
docker logs <container-id>

# Follow logs with timestamps
docker compose logs -f --timestamps order-service
```

### Test DNS Resolution

```bash
# Enter any container
docker exec -it <container-name> sh

# Test DNS resolution (should return multiple IPs for scaled services)
nslookup user-service
nslookup product-service

# Make test request
wget -O- http://product-service:3002/health
```

## Best Practices

### 1. Always Use Service Names (Not IPs)
```bash
# ✅ CORRECT
PRODUCT_SERVICE_URL=http://product-service:3002

# ❌ WRONG
PRODUCT_SERVICE_URL=http://172.18.0.5:3002
```

### 2. Implement Retry Logic for All Inter-Service Calls
```javascript
// Retry transient failures (network issues, instance restarts)
const result = await retryServiceCall(() => callOtherService());
```

### 3. Use Appropriate Timeouts
```javascript
// Set reasonable timeouts to prevent cascading failures
axios.get(url, { timeout: 5000 })
```

### 4. Handle Partial Failures Gracefully
```javascript
// If product validation fails, rollback order creation
try {
  await validateProducts();
  await createOrder();
} catch (error) {
  await rollbackOrder();
  throw error;
}
```

### 5. Use Redis for Distributed Caching
```javascript
// Cache product data to reduce inter-service calls
const product = await redis.get(`product:${productId}`);
if (!product) {
  product = await fetchFromProductService(productId);
  await redis.setex(`product:${productId}`, 300, JSON.stringify(product));
}
```

### 6. Implement Health Checks
```javascript
// Add health check endpoint in each service
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    service: 'order-service',
    timestamp: new Date().toISOString()
  });
});
```

## Troubleshooting

### Issue: Services Can't Communicate

**Symptom:** `ENOTFOUND` or connection timeout errors

**Solution:**
```bash
# 1. Check all services are on same network
docker network inspect ecommerce-network

# 2. Verify service names in docker-compose.yml match URLs in .env
# 3. Test DNS resolution from inside container
docker exec -it order-service-1 nslookup product-service
```

### Issue: Requests Not Load Balanced

**Symptom:** All requests go to same instance

**Solution:**
```bash
# 1. Ensure container_name is NOT set for scaled services
# 2. Check multiple instances are actually running
docker compose ps

# 3. Restart Docker DNS
docker compose down
docker compose up -d --scale service=3
```

### Issue: High Latency Between Services

**Solution:**
```javascript
// 1. Add connection pooling
const agent = new http.Agent({ 
  keepAlive: true, 
  maxSockets: 50 
});

// 2. Implement caching
await redis.setex(key, ttl, value);

// 3. Use parallel requests where possible
await Promise.all([call1(), call2(), call3()]);
```

## Performance Optimization

### 1. Connection Pooling
```javascript
// Reuse HTTP connections
const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 10,
  timeout: 60000
});

axios.defaults.httpAgent = agent;
```

### 2. Request Batching
```javascript
// Batch product validations
const productIds = cartItems.map(item => item.productId);
const products = await fetchProductsBatch(productIds);
```

### 3. Circuit Breaker Pattern
```javascript
// Prevent cascading failures
if (failureRate > threshold) {
  return cachedResponse; // Fail fast
}
```

## Next Steps

1. **Implement Service Mesh** (optional): Consider Istio or Linkerd for advanced features
2. **Add API Rate Limiting**: Protect services from overload
3. **Implement Distributed Tracing**: Use Jaeger or Zipkin
4. **Set Up Alerts**: Monitor service health and latency
5. **Add Circuit Breakers**: Use libraries like `opossum` for Node.js

## Summary

✅ **What You Get:**
- Automatic load balancing across 3 instances per service
- Built-in failover (if one instance crashes, others handle traffic)
- Better resource utilization
- Improved fault tolerance
- No single point of failure

✅ **What Docker DNS Does:**
- Round-robin load balancing
- Automatic service discovery
- Health-aware routing (skips unhealthy containers)

✅ **What You Need to Do:**
- Use service names (not IPs) in configuration
- Implement retry logic for transient failures
- Monitor service health
- Handle errors gracefully