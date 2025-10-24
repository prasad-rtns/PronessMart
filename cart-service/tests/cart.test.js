const request = require('supertest');
const app = require('../server');
const cartQueries = require('../data/cartQueries');
const { getRedisClient } = require('../config/redis');

// Mock the data layer and Redis
jest.mock('../data/cartQueries');
jest.mock('../config/redis');

describe('Cart Service Tests', () => {
  let authToken;
  let userId;
  let mockRedisClient;

  beforeAll(async () => {
    // Mock authentication token
    authToken = 'mock_jwt_token_for_testing';
    userId = 'user123';

    // Mock Redis client
    mockRedisClient = {
      get: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn()
    };
    getRedisClient.mockReturnValue(mockRedisClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/cart/:userId', () => {
    it('should get user cart with valid token', async () => {
      const mockCart = {
        userId: 'user123',
        items: [
          {
            productId: 'prod123',
            name: 'Test Product',
            price: 99.99,
            quantity: 2
          }
        ],
        subtotal: 199.98,
        discount: 0,
        total: 199.98
      };

      mockRedisClient.get.mockResolvedValue(null);
      cartQueries.findByUserId.mockResolvedValue(mockCart);

      const res = await request(app)
        .get(`/api/v1/cart/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data.items).toBeInstanceOf(Array);
    });

    it('should not get cart without authentication', async () => {
      const res = await request(app)
        .get(`/api/v1/cart/${userId}`);

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
    });

    it('should get cart from Redis cache if available', async () => {
      const mockCart = {
        userId: 'user123',
        items: [],
        total: 0
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockCart));

      const res = await request(app)
        .get(`/api/v1/cart/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(mockRedisClient.get).toHaveBeenCalledWith(`cart:${userId}`);
    });
  });

  describe('POST /api/v1/cart/:userId/items', () => {
    it('should add item to cart with valid token', async () => {
      const newItem = {
        productId: 'prod456',
        name: 'New Product',
        price: 49.99,
        quantity: 1,
        sku: 'NEWPROD123'
      };

      const updatedCart = {
        userId: 'user123',
        items: [newItem],
        subtotal: 49.99,
        total: 49.99
      };

      cartQueries.addItem.mockResolvedValue(updatedCart);

      const res = await request(app)
        .post(`/api/v1/cart/${userId}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(newItem);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].productId).toBe('prod456');
    });

    it('should not add item without authentication', async () => {
      const newItem = {
        productId: 'prod456',
        name: 'New Product',
        price: 49.99,
        quantity: 1
      };

      const res = await request(app)
        .post(`/api/v1/cart/${userId}/items`)
        .send(newItem);

      expect(res.statusCode).toEqual(401);
    });

    it('should not allow user to modify another user cart', async () => {
      const newItem = {
        productId: 'prod456',
        name: 'New Product',
        price: 49.99,
        quantity: 1
      };

      const res = await request(app)
        .post('/api/v1/cart/different_user/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newItem);

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
    });

    it('should update cache after adding item', async () => {
      const newItem = {
        productId: 'prod456',
        name: 'New Product',
        price: 49.99,
        quantity: 1
      };

      const updatedCart = {
        userId: 'user123',
        items: [newItem],
        total: 49.99
      };

      cartQueries.addItem.mockResolvedValue(updatedCart);

      await request(app)
        .post(`/api/v1/cart/${userId}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(newItem);

      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });
  });

  describe('PUT /api/v1/cart/:userId/items/:itemId', () => {
    it('should update item quantity', async () => {
      const updatedCart = {
        userId: 'user123',
        items: [
          {
            productId: 'prod123',
            name: 'Test Product',
            price: 99.99,
            quantity: 5
          }
        ],
        subtotal: 499.95,
        total: 499.95
      };

      cartQueries.updateItemQuantity.mockResolvedValue(updatedCart);

      const res = await request(app)
        .put(`/api/v1/cart/${userId}/items/prod123`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 5 });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items[0].quantity).toBe(5);
    });

    it('should remove item when quantity is 0', async () => {
      const updatedCart = {
        userId: 'user123',
        items: [],
        total: 0
      };

      cartQueries.updateItemQuantity.mockResolvedValue(updatedCart);

      const res = await request(app)
        .put(`/api/v1/cart/${userId}/items/prod123`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 0 });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.items).toHaveLength(0);
    });
  });

  describe('DELETE /api/v1/cart/:userId/items/:itemId', () => {
    it('should remove item from cart', async () => {
      const updatedCart = {
        userId: 'user123',
        items: [],
        total: 0
      };

      cartQueries.removeItem.mockResolvedValue(updatedCart);

      const res = await request(app)
        .delete(`/api/v1/cart/${userId}/items/prod123`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Item removed from cart');
    });

    it('should not remove item without authentication', async () => {
      const res = await request(app)
        .delete(`/api/v1/cart/${userId}/items/prod123`);

      expect(res.statusCode).toEqual(401);
    });
  });

  describe('DELETE /api/v1/cart/:userId/clear', () => {
    it('should clear entire cart', async () => {
      const clearedCart = {
        userId: 'user123',
        items: [],
        subtotal: 0,
        discount: 0,
        total: 0
      };

      cartQueries.clearCart.mockResolvedValue(clearedCart);

      const res = await request(app)
        .delete(`/api/v1/cart/${userId}/clear`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(0);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`cart:${userId}`);
    });
  });

  describe('Cart Caching', () => {
    it('should cache cart data in Redis', async () => {
      const mockCart = {
        userId: 'user123',
        items: [],
        total: 0
      };

      mockRedisClient.get.mockResolvedValue(null);
      cartQueries.findByUserId.mockResolvedValue(mockCart);

      await request(app)
        .get(`/api/v1/cart/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });

    it('should serve from cache when available', async () => {
      const cachedCart = {
        userId: 'user123',
        items: [],
        total: 0
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedCart));

      await request(app)
        .get(`/api/v1/cart/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(cartQueries.findByUserId).not.toHaveBeenCalled();
    });
  });

  describe('Cart Calculations', () => {
    it('should calculate subtotal correctly', async () => {
      const mockCart = {
        userId: 'user123',
        items: [
          { productId: 'p1', price: 10.00, quantity: 2 },
          { productId: 'p2', price: 25.50, quantity: 1 }
        ],
        subtotal: 45.50,
        total: 45.50
      };

      cartQueries.findByUserId.mockResolvedValue(mockCart);
      mockRedisClient.get.mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/cart/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.body.data.subtotal).toBe(45.50);
    });
  });
});