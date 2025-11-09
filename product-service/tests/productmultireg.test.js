const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const Product = require('../models/Product');
const Category = require('../models/Category');
const jwt = require('../utils/jwt');

let authToken;
let categoryId;
let subcategoryId;
let productId;

beforeAll(async () => {
  // Connect to test database
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Generate test token
  authToken = jwt.generateToken({ id: 'test-user-id', role: 'admin' });
  
  // Create test category
  const category = await Category.create({
    name: 'Electronics',
    description: 'Electronic devices'
  });
  categoryId = category._id.toString();
  
  // Create test subcategory
  const subcategory = await Category.create({
    name: 'Headphones',
    description: 'Audio headphones',
    parent: categoryId
  });
  subcategoryId = subcategory._id.toString();
});

afterAll(async () => {
  // Clean up
  await Product.deleteMany({});
  await Category.deleteMany({});
  await mongoose.connection.close();
});

describe('Product API Tests', () => {
  
  describe('POST /api/products - Create Product', () => {
    test('Should create a new product successfully', async () => {
      const productData = {
        name: 'Wireless Headphones',
        description: 'High-quality wireless headphones with noise cancellation',
        shortDescription: 'Premium wireless headphones',
        category: categoryId,
        subcategory: subcategoryId,
        brand: 'AudioTech',
        sku: 'WH-001',
        regionalPricing: [
          {
            region: 'US',
            currency: 'USD',
            basePrice: 199.99,
            salePrice: 149.99,
            tax: 8.5,
            available: true
          },
          {
            region: 'EU',
            currency: 'EUR',
            basePrice: 179.99,
            tax: 20,
            available: true
          }
        ],
        inventory: [
          {
            region: 'US',
            quantity: 100,
            warehouse: 'WH-US-001'
          },
          {
            region: 'EU',
            quantity: 50,
            warehouse: 'WH-EU-001'
          }
        ],
        images: [
          {
            url: 'https://example.com/image1.jpg',
            alt: 'Product image',
            isPrimary: true
          }
        ],
        tags: ['wireless', 'noise-cancellation', 'bluetooth'],
        dimensions: {
          length: 20,
          width: 18,
          height: 8,
          unit: 'cm'
        },
        weight: {
          value: 0.25,
          unit: 'kg'
        }
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(productData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('_id');
      expect(response.body.data.name).toBe(productData.name);
      expect(response.body.data.sku).toBe(productData.sku);
      
      productId = response.body.data._id;
    });

    test('Should fail without required fields', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Product'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('Should fail without authentication', async () => {
      await request(app)
        .post('/api/products')
        .send({ name: 'Test' })
        .expect(401);
    });
  });

  describe('GET /api/products - Get All Products', () => {
    test('Should get all products', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
    });

    test('Should filter products by region', async () => {
      const response = await request(app)
        .get('/api/products?region=US')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data[0]).toHaveProperty('pricing');
    });

    test('Should filter products by category', async () => {
      const response = await request(app)
        .get(`/api/products?category=${categoryId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('Should search products', async () => {
      const response = await request(app)
        .get('/api/products?search=wireless')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('Should paginate results', async () => {
      const response = await request(app)
        .get('/api/products?page=1&limit=10')
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });
  });

  describe('GET /api/products/:id - Get Single Product', () => {
    test('Should get product by ID', async () => {
      const response = await request(app)
        .get(`/api/products/${productId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(productId);
    });

    test('Should get product with regional pricing', async () => {
      const response = await request(app)
        .get(`/api/products/${productId}?region=US`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pricing).toBeDefined();
      expect(response.body.data.pricing.region).toBe('US');
    });

    test('Should return 404 for non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/products/${fakeId}`)
        .expect(404);
    });
  });

  describe('PUT /api/products/:id - Update Product', () => {
    test('Should update product', async () => {
      const updateData = {
        name: 'Wireless Headphones Pro',
        isFeatured: true
      };

      const response = await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.isFeatured).toBe(true);
    });

    test('Should fail without authentication', async () => {
      await request(app)
        .put(`/api/products/${productId}`)
        .send({ name: 'Test' })
        .expect(401);
    });
  });

  describe('PUT /api/products/:id/pricing/:region - Update Regional Pricing', () => {
    test('Should update regional pricing', async () => {
      const pricingData = {
        basePrice: 189.99,
        salePrice: 139.99,
        tax: 8.5
      };

      const response = await request(app)
        .put(`/api/products/${productId}/pricing/US`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(pricingData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('Should add pricing for new region', async () => {
      const pricingData = {
        currency: 'GBP',
        basePrice: 159.99,
        tax: 20,
        available: true
      };

      const response = await request(app)
        .put(`/api/products/${productId}/pricing/UK`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(pricingData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('PATCH /api/products/:id/inventory - Update Inventory', () => {
    test('Should update inventory', async () => {
      const inventoryData = {
        region: 'US',
        quantity: 75,
        warehouse: 'WH-US-001'
      };

      const response = await request(app)
        .patch(`/api/products/${productId}/inventory`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(inventoryData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('Should fail with missing required fields', async () => {
      await request(app)
        .patch(`/api/products/${productId}/inventory`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ region: 'US' })
        .expect(400);
    });
  });

  describe('GET /api/products/inventory/low-stock - Get Low Stock Products', () => {
    test('Should get low stock products', async () => {
      const response = await request(app)
        .get('/api/products/inventory/low-stock?threshold=100')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    test('Should filter by region', async () => {
      const response = await request(app)
        .get('/api/products/inventory/low-stock?threshold=100&region=US')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/products/bulk/update-prices - Bulk Update Prices', () => {
    test('Should bulk update prices', async () => {
      const updates = [
        {
          productId,
          region: 'US',
          pricing: {
            basePrice: 199.99,
            salePrice: 159.99,
            tax: 8.5
          }
        }
      ];

      const response = await request(app)
        .post('/api/products/bulk/update-prices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ updates })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('Should fail with empty updates array', async () => {
      await request(app)
        .post('/api/products/bulk/update-prices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ updates: [] })
        .expect(400);
    });
  });

  describe('GET /api/products/:id/analytics - Get Product Analytics', () => {
    test('Should get product analytics', async () => {
      const response = await request(app)
        .get(`/api/products/${productId}/analytics`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalInventory');
      expect(response.body.data).toHaveProperty('inventoryByRegion');
      expect(response.body.data).toHaveProperty('availableRegions');
    });
  });

  describe('DELETE /api/products/:id - Delete Product', () => {
    test('Should soft delete product', async () => {
      const response = await request(app)
        .delete(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify product is soft deleted
      const product = await Product.findById(productId);
      expect(product.isActive).toBe(false);
    });

    test('Should fail without authentication', async () => {
      await request(app)
        .delete(`/api/products/${productId}`)
        .expect(401);
    });
  });
});

describe('Category API Tests', () => {
  describe('GET /api/categories/tree - Get Category Tree', () => {
    test('Should get category tree', async () => {
      const response = await request(app)
        .get('/api/categories/tree')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/categories/:id/path - Get Category Path', () => {
    test('Should get category path', async () => {
      const response = await request(app)
        .get(`/api/categories/${subcategoryId}/path`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(1);
    });
  });
});