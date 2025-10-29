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
const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongo-product:27017/productdb';

// Connect to MongoDB and start server
connectDB(MONGO_URL)
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`✅ Product Service running on port ${PORT}`);
      logger.info(`📘 Swagger docs: http://localhost:${PORT}/api/v1/cart/docs`);
    });
  })
  .catch((err) => {
    logger.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
  });