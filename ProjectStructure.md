# E-commerce Microservices Project Structure

COMPLETE E-COMMERCE MICROSERVICES PROJECT STRUCTURE
====================================================

ecommerce-microservices/
│
├── api-gateway/
│   ├── nginx.conf                    # Nginx configuration with routing
│   ├── Dockerfile                    # API Gateway container
│   └── ssl/                          # SSL certificates (optional)
│
├── user-service/                     # User Management Service
│   ├── config/
│   │   ├── database.js              # MongoDB connection
│   │   └── jwt.js                   # JWT configuration
│   ├── controllers/
│   │   └── userController.js        # Request handlers
│   ├── data/                        # ✨ DATA ACCESS LAYER
│   │   └── userQueries.js           # All user database queries
│   ├── middlewares/
│   │   ├── authMiddleware.js        # JWT verification
│   │   ├── errorHandler.js          # Error handling
│   │   └── requestLogger.js         # Request logging
│   ├── models/
│   │   └── User.js                  # User schema (MongoDB)
│   ├── routes/
│   │   └── userRoutes.js            # API routes
│   ├── services/
│   │   └── userService.js           # Business logic
│   ├── utils/
│   │   ├── jwt.js                   # JWT utilities
│   │   └── logger.js                # Winston logger
│   ├── tests/
│   │   └── user.test.js             # Unit tests
│   ├── .dockerignore
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js                    # Entry point
│   └── swagger.js                   # Swagger config
│
├── product-service/                  # Product Catalog Service
│   ├── config/
│   │   └── database.js              # MongoDB connection
│   ├── controllers/
│   │   └── productController.js
│   ├── data/                        # ✨ DATA ACCESS LAYER
│   │   └── productQueries.js        # Product database queries
│   ├── middlewares/
│   │   ├── authMiddleware.js
│   │   ├── errorHandler.js
│   │   └── requestLogger.js
│   ├── models/
│   │   ├── Product.js               # Product schema
│   │   └── Category.js              # Category schema
│   ├── routes/
│   │   └── productRoutes.js
│   ├── services/
│   │   └── productService.js
│   ├── utils/
│   │   ├── jwt.js
│   │   └── logger.js
│   ├── tests/
│   │   └── product.test.js
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   └── swagger.js
│
├── cart-service/                     # Shopping Cart Service
│   ├── config/
│   │   ├── database.js              # MongoDB connection
│   │   └── redis.js                 # Redis connection
│   ├── controllers/
│   │   └── cartController.js
│   ├── data/                        # ✨ DATA ACCESS LAYER
│   │   └── cartQueries.js           # Cart database queries
│   ├── middlewares/
│   │   ├── authMiddleware.js
│   │   ├── errorHandler.js
│   │   └── requestLogger.js
│   ├── models/
│   │   └── Cart.js                  # Cart schema
│   ├── routes/
│   │   └── cartRoutes.js
│   ├── services/
│   │   └── cartService.js           # Business logic + Redis caching
│   ├── utils/
│   │   ├── jwt.js
│   │   ├── logger.js
│   │   └── cache.js                 # Redis utilities
│   ├── tests/
│   │   └── cart.test.js
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   └── swagger.js
│
├── order-service/                    # Order Management Service
│   ├── config/
│   │   ├── database.js              # MySQL connection
│   │   └── kafka.js                 # Kafka configuration
│   ├── controllers/
│   │   └── orderController.js
│   ├── data/                        # ✨ DATA ACCESS LAYER
│   │   └── orderQueries.js          # Order SQL queries
│   ├── middlewares/
│   │   ├── authMiddleware.js
│   │   ├── errorHandler.js
│   │   └── requestLogger.js
│   ├── models/
│   │   └── Order.js                 # Order model (MySQL)
│   ├── routes/
│   │   └── orderRoutes.js
│   ├── services/
│   │   ├── orderService.js          # Business logic
│   │   └── kafkaProducer.js         # Kafka event producer
│   ├── utils/
│   │   ├── jwt.js
│   │   └── logger.js
│   ├── tests/
│   │   └── order.test.js
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   └── swagger.js
│
├── monitoring/                       # Monitoring Stack
│   ├── prometheus/
│   │   └── prometheus.yml           # Prometheus configuration
│   └── grafana/
│       ├── dashboards/              # Grafana dashboards
│       └── provisioning/            # Grafana provisioning
│
├── docker-compose.yml                # Main orchestration file
├── .env.example                      # Environment variables template
├── setup.sh                          # Automated setup script
├── README.md                         # Project documentation
└── DATA_LAYER_GUIDE.md              # ✨ Data Access Layer guide

=============================================================================
DATA ACCESS LAYER FILES (✨ NEW)
=============================================================================

1. user-service/data/userQueries.js
   ├── findById(userId)
   ├── findByEmail(email)
   ├── findByUsername(username)
   ├── findByUsernameOrEmail(identifier)
   ├── existsByEmailOrUsername(email, username)
   ├── create(userData)
   ├── updateById(userId, updateData)
   ├── updateLastLogin(userId)
   ├── deleteById(userId)
   ├── softDeleteById(userId)
   ├── activateById(userId)
   ├── findAll(page, limit, filters)
   ├── searchUsers(searchTerm, page, limit)
   ├── findByRole(role, page, limit)
   ├── updatePreferences(userId, preferences)
   ├── bulkUpdate(filter, updateData)
   └── getUserStats()

2. product-service/data/productQueries.js
   ├── findById(productId)
   ├── findBySku(sku)
   ├── existsBySku(sku)
   ├── create(productData)
   ├── updateById(productId, updateData)
   ├── deleteById(productId)
   ├── findAll(filters, page, limit, sort)
   ├── findByCategory(category, page, limit)
   ├── findBySubcategory(category, subcategory, page, limit)
   ├── searchProducts(searchTerm, page, limit)
   ├── findByPriceRange(minPrice, maxPrice, page, limit)
   ├── findFeaturedProducts(limit)
   ├── findByBrand(brand, page, limit)
   ├── updateStock(productId, quantity)
   ├── updateRating(productId, newRating)
   ├── findLowStockProducts(threshold)
   ├── findOutOfStockProducts()
   ├── bulkUpdate(filter, updateData)
   ├── getProductStats()
   ├── getAllCategories()
   └── getAllBrands()

3. cart-service/data/cartQueries.js
   ├── findByUserId(userId)
   ├── create(userId)
   ├── update(userId, cartData)
   ├── addItem(userId, item)
   ├── updateItemQuantity(userId, productId, quantity)
   ├── removeItem(userId, productId)
   ├── clearCart(userId)
   ├── deleteByUserId(userId)
   ├── applyCoupon(userId, couponCode, discount)
   ├── removeCoupon(userId)
   ├── getItemCount(userId)
   ├── hasProduct(userId, productId)
   ├── getAbandonedCarts(hours)
   ├── getCartsByProduct(productId)
   ├── updateProductPrice(productId, newPrice)
   ├── getCartStats()
   └── mergeCarts(guestCartId, userCartId)

4. order-service/data/orderQueries.js
   ├── create(orderData)
   ├── insertOrderItems(orderId, items)
   ├── findById(orderId)
   ├── findByOrderNumber(orderNumber)
   ├── findByUserId(userId, page, limit)
   ├── updateStatus(orderId, status)
   ├── updatePaymentStatus(orderId, paymentStatus)
   ├── update(orderId, updateData)
   ├── deleteById(orderId)
   ├── findByStatus(status, page, limit)
   ├── findByDateRange(startDate, endDate, page, limit)
   ├── getPendingOrders(limit)
   ├── getOrderStats()
   ├── getRevenueByDateRange(startDate, endDate)
   ├── getTopSellingProducts(limit)
   ├── getCustomerOrderCount(userId)
   ├── getCustomerLifetimeValue(userId)
   └── searchOrders(searchTerm, page, limit)

=============================================================================
TOTAL FILES COUNT
=============================================================================

Configuration Files:        8
Controller Files:           4
Data Layer Files:           4  ✨ NEW
Middleware Files:          12
Model Files:                5
Route Files:                4
Service Files:              5
Utility Files:             12
Test Files:                 4
Docker Files:              10
Documentation Files:        3
Monitoring Configs:         2

Total Files:              73+

=============================================================================
KEY IMPROVEMENTS WITH DATA LAYER
=============================================================================

✅ Clean Separation of Concerns
   - Database queries isolated from business logic
   - Service layer focuses on business rules
   - Controllers remain thin and focused

✅ Improved Testability
   - Easy to mock database operations
   - Unit tests are cleaner and faster
   - Can test queries independently

✅ Code Reusability
   - Query functions can be reused across services
   - No duplicate database code
   - Centralized query optimization

✅ Better Maintainability
   - Single location for all database operations
   - Easier to update queries
   - Clear naming conventions

✅ Performance Benefits
   - Easy to add query optimization
   - Centralized caching strategies
   - Query performance monitoring

✅ Scalability
   - Easy to switch databases
   - Can add query caching layer
   - Simple to implement read replicas

=============================================================================
USAGE EXAMPLE
=============================================================================

BEFORE (Without Data Layer):
-----------------------------
// services/userService.js
const User = require('../models/User');

class UserService {
  async loginUser(username, password) {
    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    }).select('+password');
    
    // ... business logic
  }
}

AFTER (With Data Layer):
------------------------
// services/userService.js
const userQueries = require('../data/userQueries');

class UserService {
  async loginUser(username, password) {
    const user = await userQueries.findByUsernameOrEmail(username);
    
    // ... business logic
  }
}

// data/userQueries.js
class UserQueries {
  async findByUsernameOrEmail(identifier) {
    try {
      return await User.findOne({
        $or: [{ username: identifier }, { email: identifier }]
      }).select('+password');
    } catch (error) {
      logger.error(`Error: ${error.message}`);
      throw error;
    }
  }
}

=============================================================================
## Quick Start Commands

```bash
# Clone and setup
git clone <repository>
cd ecommerce-microservices

# Copy environment files
cp .env.example .env
cp user-service/.env.example user-service/.env
cp product-service/.env.example product-service/.env
cp cart-service/.env.example cart-service/.env
cp order-service/.env.example order-service/.env

# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Service Ports

- API Gateway (Nginx): `http://localhost:80`
- User Service: `http://localhost:3001`
- Product Service: `http://localhost:3002`
- Cart Service: `http://localhost:3003`
- Order Service: `http://localhost:3004`
- Grafana: `http://localhost:3000`
- Prometheus: `http://localhost:9090`
- Kafka UI: `http://localhost:8080`

## API Documentation

Each service has Swagger documentation available at:
- User Service: `http://localhost/api/v1/users/docs`
- Product Service: `http://localhost/api/v1/products/docs`
- Cart Service: `http://localhost/api/v1/cart/docs`
- Order Service: `http://localhost/api/v1/orders/docs`

## Testing

```bash
# Run tests for all services
docker-compose exec user-service npm test
docker-compose exec product-service npm test
docker-compose exec cart-service npm test
docker-compose exec order-service npm test
```

## Monitoring

- Grafana Dashboard: Login with `admin/admin`
- Prometheus Metrics: View all service metrics
- Custom Dashboards: Pre-configured for each microservice