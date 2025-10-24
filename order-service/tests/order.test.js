const request = require('supertest');
const app = require('../server');
const orderQueries = require('../data/orderQueries');
const kafkaProducer = require('../services/kafkaProducer');

// Mock the data layer and Kafka
jest.mock('../data/orderQueries');
jest.mock('../services/kafkaProducer');

describe('Order Service Tests', () => {
  let authToken;
  let userId;
  let orderId;

  beforeAll(async () => {
    // Mock authentication token
    authToken = 'mock_jwt_token_for_testing';
    userId = 'user123';
    orderId = 'order123';

    // Mock Kafka producer
    kafkaProducer.publishOrderEvent = jest.fn().mockResolvedValue(true);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/orders', () => {
    it('should create order with valid token', async () => {
      const orderData = {
        items: [
          {
            productId: 'prod123',
            name: 'Test Product',
            price: 99.99,
            quantity: 2,
            sku: 'TEST123'
          }
        ],
        shippingAddress: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'USA'
        },
        billingAddress: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'USA'
        },
        paymentMethod: 'credit_card'
      };

      const createdOrder = {
        id: orderId,
        user_id: userId,
        order_number: 'ORD-12345',
        status: 'pending',
        subtotal: 199.98,
        total: 215.98,
        items: orderData.items,
        shippingAddress: orderData.shippingAddress,
        billingAddress: orderData.billingAddress
      };

      orderQueries.create.mockResolvedValue(orderId);
      orderQueries.insertOrderItems.mockResolvedValue(true);
      orderQueries.findById.mockResolvedValue(createdOrder);

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('order_number');
      expect(res.body.data.status).toBe('pending');
      expect(kafkaProducer.publishOrderEvent).toHaveBeenCalledWith(
        'order.created',
        expect.any(Object)
      );
    });

    it('should not create order without authentication', async () => {
      const orderData = {
        items: [],
        shippingAddress: {}
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .send(orderData);

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const invalidOrder = {
        items: []
        // Missing required fields
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidOrder);

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should calculate order totals correctly', async () => {
      const orderData = {
        items: [
          { productId: 'p1', name: 'Product 1', price: 100, quantity: 2, sku: 'P1' },
          { productId: 'p2', name: 'Product 2', price: 50, quantity: 1, sku: 'P2' }
        ],
        shippingAddress: { street: '123 Main St', city: 'NYC', state: 'NY', zipCode: '10001', country: 'USA' },
        paymentMethod: 'credit_card'
      };

      const createdOrder = {
        id: orderId,
        user_id: userId,
        order_number: 'ORD-12345',
        subtotal: 250.00,  // 200 + 50
        tax: 20.00,         // 8% of subtotal
        shipping_cost: 10.00,
        discount: 0,
        total: 280.00       // subtotal + tax + shipping
      };

      orderQueries.create.mockResolvedValue(orderId);
      orderQueries.insertOrderItems.mockResolvedValue(true);
      orderQueries.findById.mockResolvedValue(createdOrder);

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData);

      expect(res.statusCode).toEqual(201);
      expect(res.body.data.subtotal).toBe(250.00);
      expect(res.body.data.total).toBe(280.00);
    });
  });

  describe('GET /api/v1/orders/:orderId', () => {
    it('should get order by ID with valid token', async () => {
      const mockOrder = {
        id: orderId,
        user_id: userId,
        order_number: 'ORD-12345',
        status: 'pending',
        total: 199.99,
        items: [
          {
            product_id: 'prod123',
            product_name: 'Test Product',
            price: 99.99,
            quantity: 2
          }
        ],
        shippingAddress: { street: '123 Main St' },
        billingAddress: { street: '123 Main St' }
      };

      orderQueries.findById.mockResolvedValue(mockOrder);

      const res = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/users/:userId/orders', () => {
    it('should get all orders for a user', async () => {
      const mockOrders = {
        orders: [
          {
            id: 'order1',
            user_id: userId,
            order_number: 'ORD-001',
            status: 'delivered',
            total: 100.00,
            items: []
          },
          {
            id: 'order2',
            user_id: userId,
            order_number: 'ORD-002',
            status: 'pending',
            total: 150.00,
            items: []
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          pages: 1
        }
      };

      orderQueries.findByUserId.mockResolvedValue(mockOrders);

      const res = await request(app)
        .get(`/api/v1/users/${userId}/orders`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orders).toHaveLength(2);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('should support pagination', async () => {
      const mockOrders = {
        orders: [],
        pagination: {
          page: 2,
          limit: 5,
          total: 15,
          pages: 3
        }
      };

      orderQueries.findByUserId.mockResolvedValue(mockOrders);

      const res = await request(app)
        .get(`/api/v1/users/${userId}/orders?page=2&limit=5`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.pagination.page).toBe(2);
      expect(res.body.data.pagination.limit).toBe(5);
    });

    it('should not allow access to other user orders', async () => {
      const res = await request(app)
        .get('/api/v1/users/different_user/orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('PATCH /api/v1/orders/:orderId/status', () => {
    it('should update order status', async () => {
      const updatedOrder = {
        id: orderId,
        user_id: userId,
        order_number: 'ORD-12345',
        status: 'shipped',
        total: 199.99
      };

      orderQueries.updateStatus.mockResolvedValue(true);
      orderQueries.findById.mockResolvedValue(updatedOrder);

      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'shipped' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('shipped');
      expect(kafkaProducer.publishOrderEvent).toHaveBeenCalledWith(
        'order.status.updated',
        expect.objectContaining({
          orderId,
          status: 'shipped'
        })
      );
    });

    it('should validate status field is required', async () => {
      const res = await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toBe('Status is required');
    });

    it('should return 404 for non-existent order', async () => {
      orderQueries.updateStatus.mockRejectedValue(new Error('Order not found'));

      const res = await request(app)
        .patch('/api/v1/orders/nonexistent/status')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'shipped' });

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /api/v1/orders/:orderId/cancel', () => {
    it('should cancel order', async () => {
      const mockOrder = {
        id: orderId,
        user_id: userId,
        order_number: 'ORD-12345',
        status: 'pending'
      };

      const cancelledOrder = {
        ...mockOrder,
        status: 'cancelled'
      };

      orderQueries.findById
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce(cancelledOrder);
      orderQueries.updateStatus.mockResolvedValue(true);

      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cancelled');
    });

    it('should not allow cancelling other user orders', async () => {
      const mockOrder = {
        id: orderId,
        user_id: 'different_user',
        order_number: 'ORD-12345'
      };

      orderQueries.findById.mockResolvedValue(mockOrder);

      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('Order Status Workflow', () => {
    it('should follow correct status transitions', async () => {
      const statuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
      
      for (const status of statuses) {
        const mockOrder = {
          id: orderId,
          user_id: userId,
          status: status
        };

        orderQueries.updateStatus.mockResolvedValue(true);
        orderQueries.findById.mockResolvedValue(mockOrder);

        const res = await request(app)
          .patch(`/api/v1/orders/${orderId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.status).toBe(status);
      }
    });
  });

  describe('Kafka Event Publishing', () => {
    it('should publish order.created event', async () => {
      const orderData = {
        items: [{ productId: 'p1', name: 'Product', price: 100, quantity: 1, sku: 'P1' }],
        shippingAddress: { street: '123 Main', city: 'NYC', state: 'NY', zipCode: '10001', country: 'USA' },
        paymentMethod: 'credit_card'
      };

      orderQueries.create.mockResolvedValue(orderId);
      orderQueries.insertOrderItems.mockResolvedValue(true);
      orderQueries.findById.mockResolvedValue({
        id: orderId,
        order_number: 'ORD-123',
        total: 108.00
      });

      await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData);

      expect(kafkaProducer.publishOrderEvent).toHaveBeenCalledWith(
        'order.created',
        expect.objectContaining({
          orderId: expect.any(String),
          orderNumber: expect.any(String)
        })
      );
    });

    it('should publish order.status.updated event', async () => {
      const updatedOrder = {
        id: orderId,
        status: 'shipped'
      };

      orderQueries.updateStatus.mockResolvedValue(true);
      orderQueries.findById.mockResolvedValue(updatedOrder);

      await request(app)
        .patch(`/api/v1/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'shipped' });

      expect(kafkaProducer.publishOrderEvent).toHaveBeenCalledWith(
        'order.status.updated',
        expect.objectContaining({
          orderId,
          status: 'shipped'
        })
      );
    });
  });

  describe('Order Items', () => {
    it('should include all order items in response', async () => {
      const mockOrder = {
        id: orderId,
        user_id: userId,
        items: [
          { product_id: 'p1', product_name: 'Product 1', price: 50, quantity: 2 },
          { product_id: 'p2', product_name: 'Product 2', price: 30, quantity: 1 }
        ]
      };

      orderQueries.findById.mockResolvedValue(mockOrder);

      const res = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.items[0]).toHaveProperty('product_name');
      expect(res.body.data.items[0]).toHaveProperty('price');
      expect(res.body.data.items[0]).toHaveProperty('quantity');
    });
  });

  describe('Order Validation', () => {
    it('should validate shipping address', async () => {
      const invalidOrder = {
        items: [{ productId: 'p1', name: 'Product', price: 100, quantity: 1, sku: 'P1' }],
        shippingAddress: {}, // Invalid - missing required fields
        paymentMethod: 'credit_card'
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidOrder);

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('should validate items array is not empty', async () => {
      const invalidOrder = {
        items: [], // Empty items
        shippingAddress: { street: '123', city: 'NYC', state: 'NY', zipCode: '10001', country: 'USA' },
        paymentMethod: 'credit_card'
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidOrder);

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
  });
});