require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/database');
const productRoutes = require('./routes/productRoutes');
const errorHandler = require('./middlewares/errorHandler');
const requestLogger = require('./middlewares/requestLogger');
const logger = require('./utils/logger');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { register, collectDefaultMetrics } = require('prom-client');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3002;

// Collect Prometheus metrics
collectDefaultMetrics({ register });

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Swagger Documentation
app.use('/api/v1/products/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    service: 'product-service',
    message: 'Product Service is running 🚀',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'product-service',
    timestamp: new Date().toISOString(),
  });
});

// Readiness endpoint
app.get('/ready', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: err.message });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Routes
app.use('/api/v1/products', productRoutes);

// Error Handler
app.use(errorHandler);

// ✅ Correct MongoDB service name
const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongo-product:27017/productdb';

// Connect to MongoDB and start server
connectDB(MONGO_URL)
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`✅ Product Service running on port ${PORT}`);
      logger.info(`📘 Swagger docs: http://localhost:${PORT}/api/v1/products/docs`);
    });
  })
  .catch((err) => {
    logger.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
  });