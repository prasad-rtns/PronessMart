require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/database');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const productMultiRegRoutes = require('./routes/productMultiRegRoutes');
const errorHandler = require('./middlewares/errorHandler');
const requestLogger = require('./middlewares/requestLogger');
const logger = require('./utils/logger');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { register, collectDefaultMetrics } = require('prom-client');
const mongoose = require('mongoose');
const eventHandlers = require('./services/eventHandlers');
const requestMetrics = require('./middlewares/requestMetrics');

const app = express();
const PORT = process.env.PORT || 3002;
const serviceName = process.env.SERVICE_NAME || 'product-service';

// Collect Prometheus metrics
collectDefaultMetrics({ register });

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(requestMetrics);

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
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// Routes
app.use('/api/v1/products', productRoutes);
// API Routes
app.use('/api/v2/products', productMultiRegRoutes);
app.use('/api/v2/categories', categoryRoutes);

// Error Handler
app.use(errorHandler);

// ✅ Correct MongoDB service name
const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongo-product:27017/productdb';

// Connect to MongoDB and start server
// connectDB(MONGO_URL)
//   .then(() => {
//     app.listen(PORT, '0.0.0.0', () => {
//       logger.info(`✅ Product Service running on port ${PORT}`);
//       logger.info(`📘 Swagger docs: http://localhost:${PORT}/api/v1/products/docs`);
//     });
//   })
//   .catch((err) => {
//     logger.error('❌ Failed to connect to MongoDB:', err);
//     process.exit(1);
//   });

// Start server
const startServer = async () => {
  try {
    logger.info(`startServer service running on port ${PORT}`);  
    // Connect to MongoDB
    await connectDB();
    logger.info('Database connected successfully');

    // Initialize Kafka event handlers
    logger.info('Initialize Kafka event handlers');
    logger.info(`Initialize Kafka event handlers ${process.env.ENABLE_KAFKA}`);
    if (process.env.ENABLE_KAFKA) {
      await eventHandlers.initialize();
      logger.info('Kafka event handlers initialized');
    } else {
      logger.info('Kafka is disabled, skipping event handler initialization');
    }

    // Start server
    app.listen(PORT, () => {
      logger.info(`Product service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.info(`startServer service running on port ${PORT}`);  
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  const { disconnect } = require('./config/kafka');
  await disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  const { disconnect } = require('./config/kafka');
  await disconnect();
  process.exit(0);
});

startServer();