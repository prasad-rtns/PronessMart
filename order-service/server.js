require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectDB } = require('./config/database');
const { connectProducer, disconnect } = require('./services/kafkaProducer');
const orderRoutes = require('./routes/orderRoutes');
const errorHandler = require('./middlewares/errorHandler');
const requestLogger = require('./middlewares/requestLogger');
const logger = require('./utils/logger');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { register, collectDefaultMetrics } = require('prom-client');
const healthRoutes = require('./routes/healthRoutes');
const healthController = require('./controllers/healthController');
const requestMetrics = require('./middlewares/requestMetrics');

const app = express();
const PORT = process.env.PORT || 3004;
const SERVICE_NAME = 'order-service';

// Metrics setup
collectDefaultMetrics({ register });

// Initialize dependencies (DB + Kafka)
const initializeConnections = async () => {
  try {
    logger.info(`[${SERVICE_NAME}] Connecting to MySQL...`);
    await connectDB();
    logger.info(`[${SERVICE_NAME}] MySQL connection successful ✅`);

    logger.info(`[${SERVICE_NAME}] Connecting to Kafka...`);
    await connectProducer();
    logger.info(`[${SERVICE_NAME}] Kafka producer connected ✅`);
  } catch (error) {
    logger.error(`[${SERVICE_NAME}] Initialization failed: ${error.message}`);
    process.exit(1);
  }
};

initializeConnections();

// Global middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(requestMetrics);

app.get('/health', healthController.healthCheck);
// Swagger setup
app.use('/api/v1/orders/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
}));

// Swagger JSON endpoint
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Health endpoint
// app.get('/health', (req, res) => {
//   res.status(200).json({
//     status: 'UP',
//     service: SERVICE_NAME,
//     timestamp: new Date().toISOString(),
//   });
// });

// Prometheus metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Core routes
//app.use('/api/v1/orders', orderRoutes);
//app.use('/api/v1/users/:userId/orders', orderRoutes);
app.use('/api/v1/orders', orderRoutes);
// Register health routes (before other routes)
app.use('/api/v1/orders/health', healthRoutes);

// Error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info(`[${SERVICE_NAME}] SIGTERM received. Closing connections...`);
  await disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 ${SERVICE_NAME} running on port ${PORT}`);
  logger.info(`📘 Swagger docs: http://localhost:${PORT}/api/v1/orders/docs`);
  logger.info(`💓 Health check: http://localhost:${PORT}/health`);
  logger.info(`Handled by ${process.env.HOSTNAME}`);
});

module.exports = app;
