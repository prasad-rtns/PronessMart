# PRONESS-Mart
### Shop Smart, Live Better – A Professional Growth Initiative
- [ ] <span style="color: purple">PRONESS</span> — Prasad, Rajan, O representing collaboration, Nagendra, E (for excellence), Soujanya, Shivam
- [ ] <span style="color: purple">Mart</span> — connects directly with e-commerce and digital retail


## Getting started

## 🏗️ Architecture

- **API Gateway**: Nginx (Single point of contact)
- **Microservices**: User, Product, Cart, Order
- **Databases**: MongoDB (User, Product, Cart), MySQL (Order), Redis (Cache)
- **Message Queue**: Apache Kafka
- **Monitoring**: Prometheus & Grafana
- **Authentication**: JWT tokens
- **Documentation**: Swagger/OpenAPI

## 📋 Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- Git

## 🚀 Quick Start

### 1. Clone and Setup

```bash
git clone 
cd ecommerce-microservices

# Copy environment files
cp .env.example .env
cp user-service/.env.example user-service/.env
cp product-service/.env.example product-service/.env
cp cart-service/.env.example cart-service/.env
cp order-service/.env.example order-service/.env

# Update .env files with secure values
```

### 2. Start All Services

```bash
# Build and start all containers
docker-compose up -d --build

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f user-service
```

### 3. Verify Services

```bash
# Check if all containers are running
docker-compose ps

# Test API Gateway
curl http://localhost/health

# Test individual services
curl http://localhost:3001/health  # User Service
curl http://localhost:3002/health  # Product Service
curl http://localhost:3003/health  # Cart Service
curl http://localhost:3004/health  # Order Service
```

## 🔌 API Endpoints

### User Service (Authentication)

```bash
# Register
POST http://localhost/api/v1/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securePass123",
  "firstName": "John",
  "lastName": "Doe"
}

# Login
POST http://localhost/api/v1/auth/login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "securePass123"
}

# Get User (requires token)
GET http://localhost/api/v1/users/{userId}
Authorization: Bearer 

# Update User (requires token)
PUT http://localhost/api/v1/users/{userId}
Authorization: Bearer 

# Delete User (requires token)
DELETE http://localhost/api/v1/users/{userId}
Authorization: Bearer 
```

### Product Service

```bash
# Get All Products (public)
GET http://localhost/api/v1/products?category=electronics&page=1&limit=20

# Get Product by ID (public)
GET http://localhost/api/v1/products/{productId}

# Create Product (requires token)
POST http://localhost/api/v1/products
Authorization: Bearer 
Content-Type: application/json

{
  "name": "iPhone 15 Pro",
  "description": "Latest iPhone model",
  "price": 999.99,
  "category": "electronics",
  "sku": "IPH15PRO",
  "stock": 50,
  "images": [{"url": "https://example.com/image.jpg"}]
}
```

### Cart Service

```bash
# Get Cart (requires token)
GET http://localhost/api/v1/cart/{userId}
Authorization: Bearer 

# Add Item to Cart (requires token)
POST http://localhost/api/v1/cart/{userId}/items
Authorization: Bearer 
Content-Type: application/json

{
  "productId": "product_id_here",
  "name": "iPhone 15 Pro",
  "price": 999.99,
  "quantity": 1,
  "sku": "IPH15PRO"
}

# Update Cart Item (requires token)
PUT http://localhost/api/v1/cart/{userId}/items/{itemId}
Authorization: Bearer 
Content-Type: application/json

{
  "quantity": 2
}

# Remove Item from Cart (requires token)
DELETE http://localhost/api/v1/cart/{userId}/items/{itemId}
Authorization: Bearer 
```

### Order Service

```bash
# Create Order (requires token)
POST http://localhost/api/v1/orders
Authorization: Bearer 
Content-Type: application/json

{
  "items": [
    {
      "productId": "product_id",
      "name": "iPhone 15 Pro",
      "price": 999.99,
      "quantity": 1,
      "sku": "IPH15PRO"
    }
  ],
  "shippingAddress": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  },
  "paymentMethod": "credit_card"
}

# Get Order by ID (requires token)
GET http://localhost/api/v1/orders/{orderId}
Authorization: Bearer 

# Get User Orders (requires token)
GET http://localhost/api/v1/users/{userId}/orders
Authorization: Bearer 

# Update Order Status (requires token)
PATCH http://localhost/api/v1/orders/{orderId}/status
Authorization: Bearer 
Content-Type: application/json

{
  "status": "shipped"
}
```

## 📊 Monitoring & Documentation

### Swagger Documentation
- User Service: http://localhost/api/v1/users/docs
- Product Service: http://localhost/api/v1/products/docs
- Cart Service: http://localhost/api/v1/cart/docs
- Order Service: http://localhost/api/v1/orders/docs

### Monitoring Dashboards
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Kafka UI**: http://localhost:8080

## 🧪 Testing

### Run Unit Tests

```bash
# Test all services
docker-compose exec user-service npm test
docker-compose exec product-service npm test
docker-compose exec cart-service npm test
docker-compose exec order-service npm test

# Run with coverage
docker-compose exec user-service npm test -- --coverage
```

### Manual Testing with cURL

```bash
# Complete workflow example
# 1. Register
curl -X POST http://localhost/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'

# 2. Login and get token
TOKEN=$(curl -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}' \
  | jq -r '.data.token')

# 3. Get user profile
curl http://localhost/api/v1/users/{userId} \
  -H "Authorization: Bearer $TOKEN"

# 4. Get products
curl http://localhost/api/v1/products?category=electronics

# 5. Add to cart
curl -X POST http://localhost/api/v1/cart/{userId}/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productId":"prod123","name":"Product","price":99.99,"quantity":1}'

# 6. Create order
curl -X POST http://localhost/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items":[...],"shippingAddress":{...}}'
```

## 🛠️ Development

### Local Development Setup

```bash
# Install dependencies for a service
cd user-service
npm install

# Run in development mode
npm run dev

# Run tests
npm test
```

### Adding New Services

1. Create service directory with structure
2. Add to `docker-compose.yml`
3. Update nginx configuration
4. Add to monitoring

## 📁 Project Structure

```
ecommerce-microservices/
├── api-gateway/           # Nginx API Gateway
├── user-service/          # User management & auth
├── product-service/       # Product catalog
├── cart-service/          # Shopping cart with Redis
├── order-service/         # Order management with MySQL
├── monitoring/            # Prometheus & Grafana configs
├── docker-compose.yml     # Main orchestration file
└── README.md
```

## 🔒 Security Features

- JWT token-based authentication
- Password hashing with bcrypt
- Rate limiting on API Gateway
- CORS configuration
- Helmet security headers
- Input validation
- SQL injection prevention
- XSS protection

## 🚦 Load Balancing & Scaling

```bash
# Scale a service
docker-compose up -d --scale product-service=3

# View scaled instances
docker-compose ps
```

## 🐛 Troubleshooting

### Services Not Starting

```bash
# Check logs
docker-compose logs -f [service-name]

# Restart specific service
docker-compose restart [service-name]

# Rebuild service
docker-compose up -d --build [service-name]
```

### Database Connection Issues

```bash
# Check database containers
docker-compose ps mongo-user mongo-product mongo-cart mysql redis

# Access database directly
docker-compose exec mongo-user mongosh
docker-compose exec mysql mysql -u root -p
docker-compose exec redis redis-cli
```

### Clear All Data

```bash
# Stop and remove all containers and volumes
docker-compose down -v

# Rebuild from scratch
docker-compose up -d --build
```

## 📝 Environment Variables

Key environment variables to configure:

- `JWT_SECRET`: Secret key for JWT tokens (min 32 characters)
- `MYSQL_ROOT_PASSWORD`: MySQL root password
- `MONGODB_URI`: MongoDB connection string
- `REDIS_HOST`: Redis host
- `KAFKA_BROKERS`: Kafka broker addresses

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

MIT License

## 👥 Support

For issues and questions:
- Create an issue on GitHub
- Check documentation
- Review logs for errors

## 🎯 Future Enhancements

- [ ] Add payment gateway integration
- [ ] Implement email notifications
- [ ] Add product reviews and ratings
- [ ] Implement search service with Elasticsearch
- [ ] Add admin dashboard
- [ ] Implement OAuth2.0 social login
- [ ] Add CI/CD pipeline
- [ ] Kubernetes deployment configs
- [ ] Add API rate limiting per user
- [ ] Implement caching strategies

## Usage
Use examples liberally, and show the expected output if you can. It's helpful to have inline the smallest example of usage that you can demonstrate, while providing links to more sophisticated examples if they are too long to reasonably include in the README.

## Support
Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap
If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing
State if you are open to contributions and what your requirements are for accepting them.

For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## Authors and acknowledgment
Show your appreciation to those who have contributed to the project.

## License
For open source projects, say how it is licensed.

## Project status
If you have run out of energy or time for your project, put a note at the top of the README saying that development has slowed down or stopped completely. Someone may choose to fork your project or volunteer to step in as a maintainer or owner, allowing your project to keep going. You can also make an explicit request for maintainers.

#Kafka Consumer output
`docker exec -it 013da1b415bc bash`
`/usr/bin/kafka-console-consumer --bootstrap-server localhost:9092 --topic order-events --from-beginning`
