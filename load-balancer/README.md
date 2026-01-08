## Option 1: Simple Scaling (after removing container_name)
# 1. Remove container_name from services you want to scale
# 2. Docker will automatically name containers as: <project>-<service>-<index>
# 3. Port conflicts: When scaling, don't map host ports directly. Use a load balancer instead.
# 4. Service Discovery: Containers can still find each other via service name (e.g., api-gateway) - Docker's internal DNS handles load balancing


```
# Stop existing containers
docker-compose down

# Start with 3 instances
docker-compose up -d --scale api-gateway=3
docker-compose up -d --no-deps --scale order-service=2 order-service

# Verify
docker-compose ps
```

## Option 2: Use a Load Balancer (Better for Production)
# For proper scaling with load balancing, add an HAProxy or Nginx load balancer:

```
# Create load-balancer directory
mkdir -p load-balancer

# Copy the haproxy.cfg file to load-balancer/haproxy.cfg

# Stop existing containers
docker-compose down

# Start with load balancer and 3 API gateway instances
docker-compose up -d --scale api-gateway=3

# Access via load balancer
# HTTP:  http://localhost:8090
# HTTPS: https://localhost:8443
# Stats: http://localhost:8404/stats

# Verify
docker-compose ps
```