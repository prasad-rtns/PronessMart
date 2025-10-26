const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Cart Service API',
      version: '1.0.0',
      description:
        'Microservice responsible for managing user shopping carts with Redis caching and MongoDB persistence.',
      contact: {
        name: 'PRONESS-Mart API Support',
        email: 'support@pronessmart.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:8090', // via Nginx API Gateway
        description: 'Through API Gateway',
      },
      {
        url: 'http://localhost:3003', // direct access
        description: 'Direct Cart Service Access',
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
        CartItem: {
          type: 'object',
          properties: {
            productId: { type: 'string', example: '664f9b86aab2a19b13df0f88' },
            name: { type: 'string', example: 'Wireless Mouse' },
            price: { type: 'number', example: 999.99 },
            quantity: { type: 'integer', example: 2 },
            image: { type: 'string', example: 'https://cdn.pronessmart.com/mouse.jpg' },
            sku: { type: 'string', example: 'LOG-MX518' },
          },
        },
        Cart: {
          type: 'object',
          properties: {
            userId: { type: 'string', example: 'user123' },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/CartItem' },
            },
            subtotal: { type: 'number', example: 1999.98 },
            discount: { type: 'number', example: 199.99 },
            total: { type: 'number', example: 1799.99 },
            couponCode: { type: 'string', example: 'WELCOME10' },
            lastModified: { type: 'string', example: '2025-10-27T12:30:00.000Z' },
          },
        },
        CartResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Item added to cart' },
            data: { $ref: '#/components/schemas/Cart' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Not authorized to modify this cart' },
          },
        },
      },
    },
  },
  apis: [__dirname + '/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
