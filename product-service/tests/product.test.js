const request = require('supertest');
const app = require('../server');
const User = require('../models/User');

describe('User Service Tests', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    // Setup test environment
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data).toHaveProperty('user');
      
      authToken = res.body.data.token;
      userId = res.body.data.user._id;
    });

    it('should not register user with duplicate email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser2',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(res.statusCode).toEqual(500);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login existing user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('token');
    });

    it('should not login with wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });

      expect(res.statusCode).toEqual(500);
    });
  });

  describe('GET /api/v1/users/:userId', () => {
    it('should get user by ID with valid token', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('email', 'test@example.com');
    });

    it('should not get user without token', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${userId}`);

      expect(res.statusCode).toEqual(401);
    });
  });

  describe('PUT /api/v1/users/:userId', () => {
    it('should update user profile', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('firstName', 'Updated');
    });
  });

  describe('DELETE /api/v1/users/:userId', () => {
    it('should delete user', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });
});