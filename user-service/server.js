require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/database');
const userRoutes = require('./routes/userRoutes');
const errorHandler = require('./middlewares/errorHandler');
const requestLogger = require('./middlewares/requestLogger');
const logger = require('./utils/logger');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { register, collectDefaultMetrics } = require('prom-client');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3001;

// Collect Prometheus metrics
collectDefaultMetrics({ register });

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Swagger documentation
app.use('/api/v1/users/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check (liveness)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'user-service',
    timestamp: new Date().toISOString(),
  });
});

// Readiness check (DB connection)
app.get('/ready', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: err.message });
  }
});

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// API routes
app.use('/api/v1/auth', userRoutes);
app.use('/api/v1/users', userRoutes);

// Error handler
app.use(errorHandler);

// --- Add this section ---
const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongo-user:27017/userdb';

// Connect to MongoDB and start the server
connectDB(MONGO_URL)
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`✅ User Service running on port ${PORT}`);
      logger.info(`📘 Swagger docs: http://localhost:${PORT}/api/v1/users/docs`);
    });
  })
  .catch((err) => {
    logger.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
  });

// Optional: friendly root route
app.get('/', (req, res) => {
  res.status(200).json({
    service: 'user-service',
    message: 'User Service is running 🚀',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});
