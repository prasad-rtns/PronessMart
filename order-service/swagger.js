const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Order Service API',
      version: '1.0.0',
      description:
        'Handles all order processing for PRONESS-Mart, including order creation, tracking, and status management via Kafka + MySQL.',
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
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
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
            productId: { type: 'string', example: '690e57e4a06064479fc95ba4' },
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
                  "productId": "690e57e4a06064479fc95ba4",
                  "name": "Smartphone Advanced",
                  "price": 655.75,
                  "quantity": 2,
                  "sku": "ELE-336382-9842"
                },
                {
                  "productId": "770e57e4a06064479fc95cb5",
                  "name": "Wireless Earbuds",
                  "price": 199.99,
                  "quantity": 1,
                  "sku": "AUD-987654-321"
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
            productId: { type: 'string', example: '690e57e4a06064479fc95ba4' },
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
          // --- THIS IS THE UPDATE ---
          // Added the full example you provided
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
                "id": "b1f2b5cd-1234-4bdf-8a12-ccf31b08fcc4",
                "productId": "690e57e4a06064479fc95ba4",
                "name": "Smartphone Advanced",
                "price": 655.75,
                "quantity": 2,
                "sku": "ELE-336382-9842"
              },
              {
                "id": "b1f2b235cd-1234-4bdf-8a12-ccf31b08fcc4",
                "productId": "690e57e4a06064479fc95b21a4",
                "name": "Smartphone 14",
                "price": 655.75,
                "quantity": 2,
                "sku": "ELE-336382-9843"
              }
            ]
          }
        },
        
        // 6. Response Schemas (unchanged)
        OrderResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Order created successfully' },
            data: { $ref: '#/components/schemas/Order' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Order not found' },
          },
        },
      },
    },
  },
  apis: [__dirname + '/routes/*.js'],
};

module.exports = swaggerJsdoc(options);