# HAProxy Load Balancer Deployment Guide

## Problem Fixed

The HAProxy configuration file was missing a newline at the end, causing a parse error. This has been fixed along with improved configuration for Docker service discovery.

## Architecture

```
Client Requests
    ↓
HAProxy Load Balancer (Port 8090/8443)
    ↓
Round-Robin Distribution
    ├─→ api-gateway-1 (Nginx)
    ├─→ api-gateway-2 (Nginx)
    └─→ api-gateway-3 (Nginx)
         ↓
    Microservices (3 instances each)
    ├─→ user-service (x3)
    ├─→ product-service (x3)
    ├─→ cart-service (x3)
    └─→ order-service (x3)
```

## Files Updated

### 1. `load-balancer/haproxy.cfg`
- ✅ Fixed missing newline at end of file
- ✅ Added Docker DNS resolver configuration
- ✅ Improved health check configuration
- ✅ Added proper backend routing
- ✅ Added HAProxy stats page

### 2. `docker-compose.yml`
- ✅ Added replica configuration for all services
- ✅ Added environment variables for circuit breaker
- ✅ Configured HAProxy DNS settings
- ✅ Exposed HAProxy stats on port 8404

## Deployment Steps

### Step 1: Create HAProxy Configuration Directory

```bash
# Create directory if it doesn't exist
mkdir -p load-balancer

# Add the fixed haproxy.cfg
# (Use the artifact provided above)
```

### Step 2: Verify Configuration

```bash
# Test HAProxy configuration
docker run --rm -v $(pwd)/load-balancer:/usr/local/etc/haproxy:ro haproxy:2.8-alpine haproxy -c -f /usr/local/etc/haproxy/haproxy.cfg

# Should output: "Configuration file is valid"
```

### Step 3: Stop Existing Services

```bash
# Stop all services
docker compose down

# Remove old containers
docker compose rm -f
```

### Step 4: Build Images

```bash
# Build all service images
docker compose build

# Or build specific services
docker compose build api-gateway order-service
```

### Step 5: Start with Scaling

```bash
# Start all services with scaling
docker compose up -d \
  --scale api-gateway=3 \
  --scale user-service=3 \
  --scale product-service=3 \
  --scale cart-service=3 \
  --scale order-service=3
```

### Step 6: Verify Deployment

```bash
# Check all services are running
docker compose ps

# Expected output:
# - load-balancer (1 instance)
# - api-gateway-1, api-gateway-2, api-gateway-3
# - order-service-1, order-service-2, order-service-3
# - user-service-1, user-service-2, user-service-3
# - product-service-1, product-service-2, product-service-3
# - cart-service-1, cart-service-2, cart-service-3
```

## Testing

### Test 1: HAProxy Stats Page

```bash
# Open in browser
http://localhost:8404/stats

# Or via curl
curl http://localhost:8404/stats
```

Expected: HAProxy statistics dashboard showing all backend servers

### Test 2: Health Check via Load Balancer

```bash
# Test health endpoint
curl http://localhost:8090/health | jq

# Should return full JSON response from order-service
{
  "success": true,
  "status": "healthy",
  "service": "order-service",
  ...
}
```

### Test 3: Load Distribution

```bash
# Make multiple requests
for i in {1..10}; do
  curl -s http://localhost:8090/health | jq -r '.service'
done

# Check HAProxy stats to see requests distributed across backends
curl -s http://localhost:8404/stats | grep api-gateway
```

### Test 4: API Requests

```bash
# Test order creation (should work through load balancer)
curl -X POST http://localhost:8090/api/v1/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123",
    "items": [...]
  }'
```

## Monitoring

### HAProxy Stats Dashboard

Access: `http://localhost:8090:8404/stats`

Shows:
- **Frontend Status**: Incoming requests
- **Backend Status**: Each API gateway instance
- **Server Health**: Green (UP) or Red (DOWN)
- **Request Rate**: Requests per second
- **Response Times**: Average, max
- **Session Count**: Active connections

### View Logs

```bash
# HAProxy logs
docker compose logs -f load-balancer

# API Gateway logs
docker compose logs -f api-gateway

# Order Service logs
docker compose logs -f order-service

# All logs together
docker compose logs -f
```

### Check Backend Health

```bash
# View which backends are UP
docker exec load-balancer sh -c "echo 'show servers state' | socat stdio /var/run/haproxy.sock"
```

## Troubleshooting

### Issue 1: HAProxy Won't Start

**Error**: `Configuration file is invalid`

**Solution**:
```bash
# Validate config
docker run --rm -v $(pwd)/load-balancer:/usr/local/etc/haproxy:ro \
  haproxy:2.8-alpine haproxy -c -f /usr/local/etc/haproxy/haproxy.cfg

# Check for:
# - Missing newline at end of file
# - Tab/space mixing
# - Syntax errors
```

### Issue 2: No Backend Servers Found

**Error**: `no server is available to handle this request`

**Solution**:
```bash
# Check if api-gateway instances are running
docker compose ps api-gateway

# Check HAProxy logs
docker compose logs load-balancer

# Verify network connectivity
docker compose exec load-balancer ping api-gateway
```

### Issue 3: Health Checks Failing

**Symptom**: Backends marked as DOWN in stats

**Solution**:
```bash
# Test health endpoint directly
curl http://localhost:3004/health

# Check nginx configuration in api-gateway
docker compose exec api-gateway nginx -t

# Restart api-gateway
docker compose restart api-gateway
```

### Issue 4: Requests Not Distributed Evenly

**Symptom**: All requests go to one backend

**Solution**:
```bash
# Check HAProxy stats
curl http://localhost:8404/stats | grep api-gateway

# Verify balance algorithm in haproxy.cfg
# Should see: balance roundrobin

# Restart load balancer
docker compose restart load-balancer
```

## Performance Tuning

### HAProxy Configuration

```haproxy
# In haproxy.cfg, adjust these values:

global
    maxconn 4096  # Maximum connections (increase for high traffic)

defaults
    timeout connect 5000ms   # Connection timeout
    timeout client  50000ms  # Client timeout
    timeout server  50000ms  # Server timeout

backend api_gateway_backend
    balance roundrobin      # Options: roundrobin, leastconn, source
    default-server inter 3s # Health check interval
```

### Scaling Services

```bash
# Scale up
docker compose up -d --scale api-gateway=5 --scale order-service=5

# Scale down
docker compose up -d --scale api-gateway=2 --scale order-service=2

# Check current scale
docker compose ps | grep api-gateway
```

## Advanced Features

### Stick Tables (Session Persistence)

Add to `haproxy.cfg` if you need sticky sessions:

```haproxy
backend api_gateway_backend
    balance roundrobin
    stick-table type ip size 1m expire 30m
    stick on src
```

### SSL Termination at HAProxy

Add SSL certificate to HAProxy:

```haproxy
frontend https_front
    bind *:443 ssl crt /etc/ssl/certs/server.pem
    default_backend api_gateway_backend
```

### Rate Limiting

Add to `haproxy.cfg`:

```haproxy
frontend http_front
    # Limit to 100 requests per 10 seconds per IP
    stick-table type ip size 100k expire 30s store http_req_rate(10s)
    http-request track-sc0 src
    http-request deny if { sc_http_req_rate(0) gt 100 }
```

## Maintenance

### Graceful Reload

```bash
# Reload HAProxy config without dropping connections
docker compose exec load-balancer kill -USR2 1
```

### Drain Backend Server

```bash
# Mark server as MAINT (maintenance mode)
docker exec load-balancer sh -c "echo 'set server api_gateway_backend/nginx1 state maint' | socat stdio /var/run/haproxy.sock"

# Bring back online
docker exec load-balancer sh -c "echo 'set server api_gateway_backend/nginx1 state ready' | socat stdio /var/run/haproxy.sock"
```

### Backup Configuration

```bash
# Backup current config
cp load-balancer/haproxy.cfg load-balancer/haproxy.cfg.backup

# Restore if needed
cp load-balancer/haproxy.cfg.backup load-balancer/haproxy.cfg
docker compose restart load-balancer
```

## Complete Deployment Command

```bash
#!/bin/bash

# Complete deployment script

echo "=== Deploying with HAProxy Load Balancer ==="

# Stop existing services
echo "Stopping services..."
docker compose down

# Build images
echo "Building images..."
docker compose build

# Start infrastructure (databases, kafka)
echo "Starting infrastructure..."
docker compose up -d mongo-user mongo-product mongo-cart redis mysql zookeeper kafka-1 kafka-2 kafka-3

# Wait for Kafka to be ready
echo "Waiting for Kafka..."
sleep 30

# Start services with scaling
echo "Starting services..."
docker compose up -d \
  --scale api-gateway=3 \
  --scale user-service=3 \
  --scale product-service=3 \
  --scale cart-service=3 \
  --scale order-service=3

# Start load balancer
echo "Starting load balancer..."
docker compose up -d load-balancer

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 20

# Verify deployment
echo "Verifying deployment..."
echo ""
echo "Services:"
docker compose ps

echo ""
echo "Testing health endpoint..."
curl -s http://localhost:8090/health | jq .status

echo ""
echo "=== Deployment Complete ==="
echo "HAProxy Stats: http://localhost:8404/stats"
echo "API Gateway: http://localhost:8090"
echo "Swagger Docs: http://localhost:8090/api/v1/orders/docs"
```

## URLs

- **API Gateway**: http://localhost:8090
- **HAProxy Stats**: http://localhost:8404/stats
- **Swagger UI**: http://localhost:8090/api/v1/orders/docs
- **Health Check**: http://localhost:8090/health
- **Kafka UI**: http://localhost:8080
- **Grafana**: http://localhost:3000
- **Prometheus**: http://localhost:9090

## Summary

✅ **What You Get:**
- HAProxy load balancing across 3 API gateway instances
- Each API