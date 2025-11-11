require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/database');
const { connectRedis } = require('./config/redis');
const cartRoutes = require('./routes/cartRoutes');
const errorHandler = require('./middlewares/errorHandler');
const requestLogger = require('./middlewares/requestLogger');
const logger = require('./utils/logger');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { register, collectDefaultMetrics } = require('prom-client');
const cartKafkaConsumer = require('./services/cartKafkaConsumer');

const app = express();
const PORT = process.env.PORT || 3003;

// Prometheus metrics
collectDefaultMetrics({ register });

// Connect to MongoDB and Redis
const initializeConnections = async () => {
  await connectDB();
  await connectRedis();
};

initializeConnections();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Swagger Documentation
app.use('/api/v1/cart/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    service: 'cart-service',
    message: 'Cart Service is running 🚀',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'UP', 
    service: 'cart-service',
    timestamp: new Date().toISOString()
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Routes
app.use('/api/v1/cart', cartRoutes);

// Error Handler
app.use(errorHandler);

// Start server
// ✅ Correct MongoDB service name
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
      await cartKafkaConsumer.startConsumer();
      logger.info('Cart Kafka consumer started');
    } else {
      logger.info('Kafka is disabled, skipping event handler initialization');
    }

    // Start server
    app.listen(PORT, () => {
      logger.info(`Cart service running on port ${PORT}`);
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
  logger.info(`[${serviceName}] SIGTERM received. Closing connections...`);
  await cartKafkaConsumer.stopConsumer();
  process.exit(0);
});

startServer();