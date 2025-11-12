const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Order Service API',
      version: '1.0.0',
      description:
        'Handles all order processing for PRONESS-Mart, including order creation, tracking, status management, and health monitoring with circuit breaker support via Kafka + MySQL.',
      contact: {
        name: 'PRONESS-Mart API Team',
        email: 'support@pronessmart.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:8090',
        description: 'Development Server (via API Gateway)',
      },
      {
        url: 'http://localhost:3004',
        description: 'Direct Order Service Access',
      },
    ],
    tags: [
      {
        name: 'Orders',
        description: 'Manage user orders (creation, retrieval, updates, and cancellations)'
      },
      {
        name: 'Health & Monitoring',
        description: 'Service health checks, circuit breaker monitoring, and system diagnostics'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        // ============================================
        // ORDER SCHEMAS
        // ============================================
        
        // 1. Reusable Address Schema
        Address: {
          type: 'object',
          properties: {
            street: { type: 'string', example: '123 MG Road' },
            city: { type: 'string', example: 'Bangalore' },
            zipCode: { type: 'string', example: '560001' },
            country: { type: 'string', example: 'India' },
          },
          required: ['street', 'city', 'zipCode', 'country']
        },

        // 2. Schema for an item in a NEW order (Request)
        CreateOrderItemDTO: {
          type: 'object',
          properties: {
            productId: { type: 'string', example: '6914e60e786955184bf4681b' },
            name: { type: 'string', example: 'Smartphone Advanced' },
            price: { type: 'number', example: 655.75 },
            quantity: { type: 'integer', example: 1 },
            sku: { type: 'string', example: 'ELE-336382-9842' },
          },
          required: ['productId', 'name', 'price', 'quantity', 'sku']
        },
        
        // 3. Schema for the NEW order request body (Request)
        CreateOrderDTO: {
          type: 'object',
          properties: {
            userId: { type: 'string', example: '68ffd35931e5d76cc623e74c' },
            quoteId: { type: 'string', example: '690280517b08806759dac771' },
            paymentMethod: { type: 'string', example: 'Credit Card' },
            shippingAddress: {
              $ref: '#/components/schemas/Address'
            },
            billingAddress: {
              $ref: '#/components/schemas/Address'
            },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/CreateOrderItemDTO' },
              example: [
                {
                  "id": "b1f2b5cd-1234-4bdf-8a12-ccf31b08faa4",
                  "productId": "6914e60e786955184bf4681b",
                  "name": "Professional Laptop Max",
                  "price": 1195.75,
                  "quantity": 1,
                  "sku": "ELE-000002-3217"
                },
                {
                  "id": "b1f2b235cd-1234-4bdf-8a12-ccf31b08fbb4",
                  "productId": "6914e60e786955184bf4681d",
                  "name": "Smartphone Premium",
                  "price": 1859.84,
                  "quantity": 2,
                  "sku": "ELE-000004-6529"
                },
                {
                  "id": "b1f2b235cd-1234-4bdf-8a12-ccf31b08fcc4",
                  "productId": "6914e60e786955184bf4681a",
                  "name": "Keyboard Pro",
                  "price": 1134.68,
                  "quantity": 3,
                  "sku": "ELE-000001-8803"
                }
              ]
            }
          },
          required: ['userId', 'quoteId', 'paymentMethod', 'shippingAddress', 'billingAddress', 'items']
        },

        // 4. Schema for an item in an EXISTING order (Response)
        OrderItem: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'b1f2b5cd-1234-4bdf-8a12-ccf31b08fcc4' },
            productId: { type: 'string', example: '6914e60e786955184bf4681b' },
            name: { type: 'string', example: 'Smartphone Advanced' },
            price: { type: 'number', example: 655.75 },
            quantity: { type: 'integer', example: 2 },
            sku: { type: 'string', example: 'ELE-336382-9842' },
          }
        },

        // 5. Schema for the full Order (Response)
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'a3f2b5cd-1234-4bdf-8a12-ccf31b08fbb2' },
            userId: { type: 'string', example: '68ffd35931e5d76cc623e74c' },
            quoteId: { type: 'string', example: '690280517b08806759dac771' },
            orderNumber: { type: 'string', example: 'ORD-ABC123' },
            status: { type: 'string', example: 'pending' },
            subtotal: { type: 'number', example: 5999.98 },
            discount: { type: 'number', example: 500 },
            total: { type: 'number', example: 5499.98 },
            paymentMethod: { type: 'string', example: 'Credit Card' },
            paymentStatus: { type: 'string', example: 'pending' },
            shippingAddress: {
              $ref: '#/components/schemas/Address'
            },
            billingAddress: {
              $ref: '#/components/schemas/Address'
            },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/OrderItem' },
            },
          },
          example: {
            "id": "a3f2b5cd-1234-4bdf-8a12-ccf31b08fbb2",
            "userId": "68ffd35931e5d76cc623e74c",
            "quoteId": "690280517b08806759dac771",
            "orderNumber": "ORD-ABC123",
            "status": "pending",
            "subtotal": 5999.98,
            "discount": 500,
            "total": 5499.98,
            "paymentMethod": "Credit Card",
            "paymentStatus": "pending",
            "shippingAddress": {
              "street": "123 MG Road",
              "city": "Bangalore",
              "zipCode": "560001",
              "country": "India"
            },
            "billingAddress": {
              "street": "123 MG Road",
              "city": "Bangalore",
              "zipCode": "560001",
              "country": "India"
            },
            "items": [
              {
                "id": "b1f2b5cd-1234-4bdf-8a12-ccf31b08faa4",
                "productId": "6914e60e786955184bf4681b",
                "name": "Professional Laptop Max",
                "price": 1195.75,
                "quantity": 1,
                "sku": "ELE-000002-3217"
              },
              {
                "id": "b1f2b235cd-1234-4bdf-8a12-ccf31b08fbb4",
                "productId": "6914e60e786955184bf4681d",
                "name": "Smartphone Premium",
                "price": 1859.84,
                "quantity": 2,
                "sku": "ELE-000004-6529"
              },
              {
                "id": "b1f2b235cd-1234-4bdf-8a12-ccf31b08fcc4",
                "productId": "6914e60e786955184bf4681a",
                "name": "Keyboard Pro",
                "price": 1134.68,
                "quantity": 3,
                "sku": "ELE-000001-8803"
              }
            ]
          }
        },
        
        // 6. Order Response Schema
        OrderResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Order created successfully' },
            data: { $ref: '#/components/schemas/Order' },
          },
        },

        // ============================================
        // HEALTH & MONITORING SCHEMAS
        // ============================================

        // 7. Circuit Breaker State Schema
        CircuitBreakerState: {
          type: 'object',
          properties: {
            serviceName: { type: 'string', example: 'user-service' },
            state: { 
              type: 'string', 
              enum: ['CLOSED', 'OPEN', 'HALF_OPEN'],
              example: 'CLOSED',
              description: 'CLOSED: Normal operation, OPEN: Circuit open (rejecting requests), HALF_OPEN: Testing recovery'
            },
            failureCount: { type: 'integer', example: 0 },
            successCount: { type: 'integer', example: 0 },
            nextAttemptIn: { 
              type: 'integer', 
              example: 0,
              description: 'Time in milliseconds until next retry attempt (only when OPEN)'
            }
          }
        },

        // 8. Basic Health Response
        HealthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            status: { 
              type: 'string', 
              enum: ['healthy', 'degraded', 'unhealthy'],
              example: 'healthy' 
            },
            service: { type: 'string', example: 'order-service' },
            timestamp: { type: 'string', format: 'date-time', example: '2025-01-15T10:30:00.000Z' },
            uptime: { type: 'number', example: 3600.5, description: 'Service uptime in seconds' },
            memory: {
              type: 'object',
              properties: {
                rss: { type: 'integer', example: 52428800 },
                heapTotal: { type: 'integer', example: 18874368 },
                heapUsed: { type: 'integer', example: 12345678 },
                external: { type: 'integer', example: 1234567 }
              }
            },
            version: { type: 'string', example: '1.0.0' }
          }
        },

        // 9. Detailed Health Response
        DetailedHealthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            status: { 
              type: 'string', 
              enum: ['healthy', 'degraded', 'unhealthy'],
              example: 'healthy' 
            },
            service: { type: 'string', example: 'order-service' },
            timestamp: { type: 'string', format: 'date-time', example: '2025-01-15T10:30:00.000Z' },
            uptime: { type: 'number', example: 3600.5 },
            memory: {
              type: 'object',
              properties: {
                rss: { type: 'integer' },
                heapTotal: { type: 'integer' },
                heapUsed: { type: 'integer' },
                external: { type: 'integer' }
              }
            },
            circuitBreakers: {
              type: 'object',
              additionalProperties: {
                $ref: '#/components/schemas/CircuitBreakerState'
              },
              example: {
                "user-service": {
                  "serviceName": "user-service",
                  "state": "CLOSED",
                  "failureCount": 0,
                  "successCount": 0,
                  "nextAttemptIn": 0
                },
                "product-service": {
                  "serviceName": "product-service",
                  "state": "OPEN",
                  "failureCount": 5,
                  "successCount": 0,
                  "nextAttemptIn": 45000
                },
                "cart-service": {
                  "serviceName": "cart-service",
                  "state": "HALF_OPEN",
                  "failureCount": 0,
                  "successCount": 1,
                  "nextAttemptIn": 0
                }
              }
            },
            authCache: {
              type: 'object',
              properties: {
                total: { type: 'integer', example: 150 },
                active: { type: 'integer', example: 142 },
                expired: { type: 'integer', example: 8 },
                cacheEnabled: { type: 'boolean', example: true },
                cacheTTL: { type: 'integer', example: 300, description: 'Cache TTL in seconds' }
              }
            },
            environment: {
              type: 'object',
              properties: {
                nodeEnv: { type: 'string', example: 'production' },
                port: { type: 'string', example: '3004' }
              }
            }
          }
        },

        // 10. Circuit Breakers Response
        CircuitBreakersResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              additionalProperties: {
                $ref: '#/components/schemas/CircuitBreakerState'
              }
            },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },

        // 11. Auth Cache Stats Response
        AuthCacheStatsResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                total: { type: 'integer', example: 150 },
                active: { type: 'integer', example: 142 },
                expired: { type: 'integer', example: 8 },
                cacheEnabled: { type: 'boolean', example: true },
                cacheTTL: { type: 'integer', example: 300 }
              }
            },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },

        // 12. Generic Success Response
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation completed successfully' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },

        // 13. Error Response
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Operation failed' },
            error: { type: 'string', example: 'error_code' }
          },
        },
      },
    },
  },
  apis: [
    __dirname + '/routes/*.js',
    __dirname + '/routes/orderRoutes.js',
    __dirname + '/routes/healthRoutes.js',
  ],
};

module.exports = swaggerJsdoc(options);