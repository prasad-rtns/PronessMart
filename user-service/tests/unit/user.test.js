const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const mongoose = require('mongoose'); // Required for cleanup if needed

// Mock the logger to keep the terminal clean
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('User Service Tests', () => {
  let authToken;
  let userId;

  // ✅ FIX: Clean the database before running tests
  beforeAll(async () => {
    await User.deleteMany({});
  });

  // ✅ FIX: Clean the database after tests finish
  afterAll(async () => {
    await User.deleteMany({});
    // If Jest warns about "Open Handles", uncomment the line below:
    // await mongoose.connection.close(); 
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

      // Check for 201 Created
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('token');
      
      // Save token/ID for later tests
      authToken = res.body.data.token;
      userId = res.body.data.user._id;
    });

    it('should not register user with duplicate email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser2', // Different username
          email: 'test@example.com', // SAME email (Duplicate)
          password: 'password123'
        });

      // Check for 409 Conflict
      expect(res.statusCode).toEqual(409);
      expect(res.body).toHaveProperty('message', 'User with this email or username already exists');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login existing user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
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
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      // Check for 401 Unauthorized
      expect(res.statusCode).toEqual(401); 
      expect(res.body).toHaveProperty('message', 'Invalid credentials');
    });
  });

  describe('GET /api/v1/users/:userId', () => {
    it('should get user by ID with valid token', async () => {
      // Ensure userId exists (handles case where registration failed)
      if (!userId) throw new Error("User ID not set from previous test");

      const res = await request(app)
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('email', 'test@example.com');
    });

    it('should not get user without token', async () => {
      if (!userId) throw new Error("User ID not set from previous test");

      const res = await request(app)
        .get(`/api/v1/users/${userId}`);

      expect(res.statusCode).toEqual(401);
    });
  });

  describe('PUT /api/v1/users/:userId', () => {
    it('should update user profile', async () => {
      if (!userId) throw new Error("User ID not set from previous test");

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
      if (!userId) throw new Error("User ID not set from previous test");

      const res = await request(app)
        .delete(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });
});