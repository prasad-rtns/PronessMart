const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'User Service API',
      version: '1.0.0',
      description: 'Microservice for user registration, login, and management (JWT secured)',
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
        url: 'http://localhost:3001', // direct user-service
        description: 'Direct User Service (local)',
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
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            username: { type: 'string', example: 'john_doe' },
            email: { type: 'string', example: 'john@example.com' },
            role: { type: 'string', example: 'user' },
            isActive: { type: 'boolean', example: true },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI...' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Invalid credentials' },
          },
        },
      },
    },
  },
  apis: [__dirname + '/routes/*.js'],
};

module.exports = swaggerJsdoc(options);