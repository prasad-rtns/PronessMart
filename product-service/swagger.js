const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Product Service API',
      version: '1.0.0',
      description: 'Microservice handling product catalog management (CRUD, filtering, categories, etc.)',
      contact: {
        name: 'PRONESS-Mart API Support',
        email: 'support@pronessmart.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:8090', // via API Gateway
        description: 'Gateway Access',
      },
      {
        url: 'http://localhost:3002', // direct access
        description: 'Direct Product Service Access',
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
        Product: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '664f9b86aab2a19b13df0f88' },
            name: { type: 'string', example: 'Wireless Mouse' },
            description: { type: 'string', example: 'Ergonomic wireless mouse with 2.4GHz receiver' },
            price: { type: 'number', example: 999.99 },
            category: { type: 'string', example: 'electronics' },
            brand: { type: 'string', example: 'Logitech' },
            sku: { type: 'string', example: 'LOG-MX518' },
            stock: { type: 'integer', example: 45 },
            images: {
              type: 'array',
              items: { type: 'object', properties: { url: { type: 'string' } } },
            },
            isFeatured: { type: 'boolean', example: true },
          },
        },
        ProductCreate: {
          type: 'object',
          required: ['name', 'description', 'price', 'category', 'sku', 'stock'],
          properties: {
            name: { type: 'string', example: 'Smartphone X12' },
            description: { type: 'string', example: 'Latest smartphone with AI camera' },
            price: { type: 'number', example: 499.99 },
            category: { type: 'string', example: 'electronics' },
            subcategory: { type: 'string', example: 'mobile' },
            sku: { type: 'string', example: 'ELEC-X12' },
            stock: { type: 'integer', example: 100 },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Product created successfully' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Product not found' },
          },
        },
      },
    },
  },
  apis: [__dirname + '/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
