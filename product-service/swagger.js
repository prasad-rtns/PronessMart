const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Product Service API',
      version: '2.0.1',
      description: `
        Comprehensive Product Catalog Microservice with Multi-Region Support
        
        ## Features
        - **V1 API**: Traditional single-region product management
        - **V2 API**: Multi-region products with dynamic pricing
        - Regional pricing support (10 regions, 10 currencies)
        - Category hierarchy management
        - Inventory tracking across regions
        - Kafka event streaming
        - Advanced filtering and search
        
        ## Supported Regions
        US, EU, UK, IN, AU, CA, JP, CN, BR, MX
        
        ## Supported Currencies
        USD, EUR, GBP, INR, AUD, CAD, JPY, CNY, BRL, MXN
      `,
      contact: {
        name: 'Product Service API Support',
        email: 'support@pronessmart.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:8090',
        description: 'API Gateway (Production)',
      },
      {
        url: 'http://localhost:3002',
        description: 'Direct Product Service (Development)',
      },
      {
        url: 'http://localhost:80',
        description: 'Nginx Reverse Proxy',
      },
    ],
    tags: [
      {
        name: 'Products V1',
        description: 'Traditional product management (single region)',
      },
      {
        name: 'Products V2 - Multi-Region',
        description: 'Multi-region product management with dynamic pricing',
      },
      {
        name: 'Categories',
        description: 'Category and subcategory management',
      },
      {
        name: 'Inventory',
        description: 'Multi-region inventory management',
      },
      {
        name: 'Analytics',
        description: 'Product analytics and reporting',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from authentication service',
        },
      },
      schemas: {
        // ===== V1 Schemas =====
        Product: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '664f9b86aab2a19b13df0f88',
            },
            name: {
              type: 'string',
              example: 'Wireless Mouse',
            },
            description: {
              type: 'string',
              example: 'Ergonomic wireless mouse with 2.4GHz receiver',
            },
            price: {
              type: 'number',
              example: 999.99,
            },
            comparePrice: {
              type: 'number',
              example: 1299.99,
            },
            category: {
              type: 'string',
              enum: ['electronics', 'clothing', 'books', 'home', 'sports', 'beauty', 'toys', 'food', 'other'],
              example: 'electronics',
            },
            subcategory: {
              type: 'string',
              example: 'computer-accessories',
            },
            brand: {
              type: 'string',
              example: 'Logitech',
            },
            sku: {
              type: 'string',
              example: 'LOG-MX518',
            },
            stock: {
              type: 'integer',
              example: 45,
            },
            images: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  url: { type: 'string', example: 'https://example.com/image.jpg' },
                  alt: { type: 'string', example: 'Product image' },
                },
              },
            },
            specifications: {
              type: 'object',
              example: {
                'Connectivity': 'Wireless 2.4GHz',
                'Battery Life': '18 months',
                'DPI': '1000',
              },
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              example: ['wireless', 'ergonomic', 'computer'],
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            isFeatured: {
              type: 'boolean',
              example: false,
            },
            rating: {
              type: 'object',
              properties: {
                average: { type: 'number', example: 4.5 },
                count: { type: 'integer', example: 120 },
              },
            },
            availability: {
              type: 'string',
              enum: ['in_stock', 'out_of_stock', 'pre_order', 'discontinued'],
              example: 'in_stock',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        ProductCreate: {
          type: 'object',
          required: ['name', 'description', 'price', 'category', 'sku', 'stock'],
          properties: {
            name: { type: 'string', example: 'Smartphone X12' },
            description: { type: 'string', example: 'Latest smartphone with AI camera' },
            price: { type: 'number', example: 499.99 },
            comparePrice: { type: 'number', example: 599.99 },
            category: { type: 'string', example: 'electronics' },
            subcategory: { type: 'string', example: 'mobile' },
            brand: { type: 'string', example: 'TechBrand' },
            sku: { type: 'string', example: 'ELEC-X12' },
            stock: { type: 'integer', example: 100 },
            images: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  alt: { type: 'string' },
                },
              },
            },
            specifications: {
              type: 'object',
              example: { 'RAM': '8GB', 'Storage': '128GB' },
            },
            tags: { type: 'array', items: { type: 'string' } },
            isFeatured: { type: 'boolean', example: false },
          },
        },

        // ===== V2 Multi-Region Schemas =====
        RegionalPricing: {
          type: 'object',
          required: ['region', 'currency', 'basePrice'],
          properties: {
            region: {
              type: 'string',
              enum: ['US', 'EU', 'UK', 'IN', 'AU', 'CA', 'JP', 'CN', 'BR', 'MX'],
              example: 'US',
            },
            currency: {
              type: 'string',
              enum: ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY', 'CNY', 'BRL', 'MXN'],
              example: 'USD',
            },
            basePrice: {
              type: 'number',
              example: 299.99,
              description: 'Original price',
            },
            salePrice: {
              type: 'number',
              example: 249.99,
              description: 'Discounted price (optional)',
            },
            tax: {
              type: 'number',
              example: 8.5,
              description: 'Tax percentage',
            },
            available: {
              type: 'boolean',
              example: true,
              description: 'Product availability in this region',
            },
          },
        },
        Inventory: {
          type: 'object',
          required: ['region', 'quantity', 'warehouse'],
          properties: {
            region: {
              type: 'string',
              example: 'US',
            },
            quantity: {
              type: 'integer',
              example: 100,
              minimum: 0,
            },
            warehouse: {
              type: 'string',
              example: 'WH-US-001',
            },
            lastUpdated: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        ProductMultiReg: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '664f9b86aab2a19b13df0f88' },
            name: { type: 'string', example: 'Wireless Headphones Pro' },
            slug: { type: 'string', example: 'wireless-headphones-pro' },
            description: { type: 'string', example: 'Premium wireless headphones with ANC' },
            shortDescription: { type: 'string', example: 'Premium wireless headphones' },
            category: {
              type: 'object',
              properties: {
                _id: { type: 'string' },
                name: { type: 'string', example: 'Electronics' },
                slug: { type: 'string', example: 'electronics' },
              },
            },
            subcategory: {
              type: 'object',
              properties: {
                _id: { type: 'string' },
                name: { type: 'string', example: 'Audio' },
                slug: { type: 'string', example: 'audio' },
              },
            },
            brand: { type: 'string', example: 'AudioTech' },
            sku: { type: 'string', example: 'WH-PRO-001' },
            barcode: { type: 'string', example: '1234567890123' },
            regionalPricing: {
              type: 'array',
              items: { $ref: '#/components/schemas/RegionalPricing' },
            },
            inventory: {
              type: 'array',
              items: { $ref: '#/components/schemas/Inventory' },
            },
            images: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  alt: { type: 'string' },
                  isPrimary: { type: 'boolean' },
                },
              },
            },
            specifications: {
              type: 'object',
              example: {
                'Battery Life': '30 hours',
                'Bluetooth': '5.0',
              },
            },
            dimensions: {
              type: 'object',
              properties: {
                length: { type: 'number' },
                width: { type: 'number' },
                height: { type: 'number' },
                unit: { type: 'string', enum: ['cm', 'in', 'm'] },
              },
            },
            weight: {
              type: 'object',
              properties: {
                value: { type: 'number' },
                unit: { type: 'string', enum: ['kg', 'lb', 'g'] },
              },
            },
            tags: { type: 'array', items: { type: 'string' } },
            ratings: {
              type: 'object',
              properties: {
                average: { type: 'number', example: 4.5 },
                count: { type: 'integer', example: 120 },
              },
            },
            isActive: { type: 'boolean', example: true },
            isFeatured: { type: 'boolean', example: false },
            availableRegions: {
              type: 'array',
              items: { type: 'string' },
              example: ['US', 'EU', 'UK'],
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ProductMultiRegCreate: {
          type: 'object',
          required: ['name', 'description', 'category', 'sku', 'regionalPricing'],
          properties: {
            name: { type: 'string', example: 'Wireless Headphones Pro' },
            description: { type: 'string', example: 'Premium wireless headphones with ANC' },
            shortDescription: { type: 'string', example: 'Premium headphones' },
            category: { type: 'string', example: '664f9b86aab2a19b13df0f88' },
            subcategory: { type: 'string', example: '664f9b86aab2a19b13df0f89' },
            brand: { type: 'string', example: 'AudioTech' },
            sku: { type: 'string', example: 'WH-PRO-001' },
            barcode: { type: 'string', example: '1234567890123' },
            regionalPricing: {
              type: 'array',
              items: { $ref: '#/components/schemas/RegionalPricing' },
              minItems: 1,
            },
            inventory: {
              type: 'array',
              items: { $ref: '#/components/schemas/Inventory' },
            },
            images: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  alt: { type: 'string' },
                  isPrimary: { type: 'boolean' },
                },
              },
            },
            specifications: { type: 'object' },
            dimensions: {
              type: 'object',
              properties: {
                length: { type: 'number' },
                width: { type: 'number' },
                height: { type: 'number' },
                unit: { type: 'string', enum: ['cm', 'in', 'm'] },
              },
            },
            weight: {
              type: 'object',
              properties: {
                value: { type: 'number' },
                unit: { type: 'string', enum: ['kg', 'lb', 'g'] },
              },
            },
            tags: { type: 'array', items: { type: 'string' } },
            isFeatured: { type: 'boolean', default: false },
            metaTitle: { type: 'string' },
            metaDescription: { type: 'string' },
            metaKeywords: { type: 'array', items: { type: 'string' } },
          },
        },

        // Category Schema
        Category: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string', example: 'Electronics' },
            slug: { type: 'string', example: 'electronics' },
            description: { type: 'string' },
            parent: { type: 'string', nullable: true },
            level: { type: 'integer', example: 0 },
            image: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                alt: { type: 'string' },
              },
            },
            icon: { type: 'string' },
            isActive: { type: 'boolean' },
            order: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // Common Response Schemas
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful' },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error message' },
          },
        },
        PaginationResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'array', items: { type: 'object' } },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer', example: 1 },
                limit: { type: 'integer', example: 20 },
                total: { type: 'integer', example: 100 },
                pages: { type: 'integer', example: 5 },
              },
            },
          },
        },
      },
    },
  },
  apis: [
    __dirname + '/routes/*.js',
    __dirname + '/routes/productRoutes.js',
    __dirname + '/routes/productMultiRegRoutes.js',
    __dirname + '/routes/categoryRoutes.js',
  ],
};

module.exports = swaggerJsdoc(options);