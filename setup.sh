#!/bin/bash

echo "🚀 Setting up E-commerce Microservices Platform..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"

# Create environment files
echo "📝 Creating environment files..."

cp .env.example .env
cp user-service/.env.example user-service/.env
cp product-service/.env.example product-service/.env
cp cart-service/.env.example cart-service/.env
cp order-service/.env.example order-service/.env

echo "✅ Environment files created"

# Generate secure JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo "🔐 Generated JWT secret"

# Update .env files with generated secret
# --- FIX: Changed delimiter from / to # to avoid errors with special characters ---
sed -i.bak "s#your_jwt_secret_key_here_change_in_production#${JWT_SECRET}#g" .env
sed -i.bak "s#your_jwt_secret_key_here_change_in_production#${JWT_SECRET}#g" user-service/.env
sed -i.bak "s#your_jwt_secret_key_here_change_in_production#${JWT_SECRET}#g" product-service/.env
sed -i.bak "s#your_jwt_secret_key_here_change_in_production#${JWT_SECRET}#g" cart-service/.env
sed -i.bak "s#your_jwt_secret_key_here_change_in_production#${JWT_SECRET}#g" order-service/.env

# Clean up backup files
rm -f .env.bak user-service/.env.bak product-service/.env.bak cart-service/.env.bak order-service/.env.bak

echo "✅ JWT secret configured"

# Generate secure MySQL password
MYSQL_PASSWORD=$(openssl rand -base64 16)

# --- FIX: Changed delimiter from / to # here as well ---
sed -i.bak "s#your_strong_mysql_password_here#${MYSQL_PASSWORD}#g" .env
sed -i.bak "s#your_mysql_password#${MYSQL_PASSWORD}#g" order-service/.env
rm -f .env.bak order-service/.env.bak

echo "✅ MySQL password configured"

# Create logs directories
echo "📁 Creating log directories..."
mkdir -p user-service/logs
mkdir -p product-service/logs
mkdir -p cart-service/logs
mkdir -p order-service/logs

echo "✅ Log directories created"

# Pull base images
echo "📥 Pulling Docker base images..."
docker pull node:18-alpine
docker pull mongo:7.0
docker pull mysql:8.0
docker pull redis:7-alpine
docker pull nginx:alpine
docker pull confluentinc/cp-zookeeper:7.5.0
docker pull confluentinc/cp-kafka:7.5.0
docker pull prom/prometheus:latest
docker pull grafana/grafana:latest

echo "✅ Base images pulled"

# Build and start containers
echo "🏗️  Building and starting containers..."
docker-compose up -d --build

echo "⏳ Waiting for services to be ready..."
sleep 30

# Check service health
echo "🏥 Checking service health..."
services=("user-service:3001" "product-service:3002" "cart-service:3003" "order-service:3004")

for service in "${services[@]}"; do
    IFS=':' read -r name port <<< "$service"
    if curl -f http://localhost:$port/health &> /dev/null; then
        echo "✅ $name is healthy"
    else
        echo "⚠️  http://localhost:$port/health"
        echo "⚠️  $name is not responding"
    fi
done

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📊 Access Points:"
echo "   API Gateway:     http://localhost"
echo "   User Service:    http://localhost:3001"
echo "   Product Service: http://localhost:3002"
echo "   Cart Service:    http://localhost:3003"
echo "   Order Service:   http://localhost:3004"
echo "   Grafana:         http://localhost:3000 (admin/admin)"
echo "   Prometheus:      http://localhost:9090"
echo "   Kafka UI:        http://localhost:8080"
echo ""
echo "📚 API Documentation:"
echo "   User Service:    http://localhost/api/v1/users/docs"
echo "   Product Service: http://localhost/api/v1/products/docs"
echo "   Cart Service:    http://localhost/api/v1/cart/docs"
echo "   Order Service:   http://localhost/api/v1/orders/docs"
echo ""
echo "🔧 Useful Commands:"
echo "   View logs:        docker-compose logs -f"
echo "   Stop services:    docker-compose down"
echo "   Restart service:  docker-compose restart <service-name>"
echo "   Run tests:        docker-compose exec <service-name> npm test"
echo ""