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
        url: 'http://localhost:8090/api/v1',
        description: 'Development Server (via API Gateway)',
      },
      {
        url: 'http://localhost:3004/api/v1',
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
        OrderItem: {
          type: 'object',
          properties: {
            productId: { type: 'string', example: 'P123' },
            name: { type: 'string', example: 'Wireless Headphones' },
            price: { type: 'number', example: 2999.99 },
            quantity: { type: 'integer', example: 2 },
            sku: { type: 'string', example: 'LOG-HS100' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'a3f2b5cd-1234-4bdf-8a12-ccf31b08fbb2' },
            userId: { type: 'string', example: 'user123' },
            orderNumber: { type: 'string', example: 'ORD-ABC123' },
            status: { type: 'string', example: 'pending' },
            subtotal: { type: 'number', example: 5999.98 },
            discount: { type: 'number', example: 500 },
            total: { type: 'number', example: 5499.98 },
            paymentMethod: { type: 'string', example: 'Credit Card' },
            paymentStatus: { type: 'string', example: 'pending' },
            shippingAddress: {
              type: 'object',
              properties: {
                street: { type: 'string', example: '123 MG Road' },
                city: { type: 'string', example: 'Bangalore' },
                zipCode: { type: 'string', example: '560001' },
                country: { type: 'string', example: 'India' },
              },
            },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/OrderItem' },
            },
          },
        },
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
