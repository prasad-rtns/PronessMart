// app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const errorHandler = require('./middlewares/errorHandler');
const requestLogger = require('./middlewares/requestLogger');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { register, collectDefaultMetrics } = require('prom-client');

const app = express();

// Prometheus Metrics
collectDefaultMetrics({ register });

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.use('/api/v1/users/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// also serve raw JSON for Postman import
app.get('/api/v1/users/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.get('/health', (req, res) => res.status(200).json({ status: 'UP' }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);

app.use(errorHandler);

/**
 * Do NOT load side-effecting integrations (Redis/Kafka/DB connect that start sockets)
 * when running tests. Instead, load them in server.js at runtime.
 */
if (process.env.NODE_ENV !== 'test') {
  // These modules must be side-effect-free or handle test mode internally.
  // Only require them when the app is actually run (not when being imported by tests).
  // e.g. config/redis initializes redis clients; config/kafka initializes kafka consumers
  // They should export clients rather than starting background loops at require-time.
//   try {
//     require('./config/redis');
//   } catch (err) {
//     // tolerate missing config in dev/test environments
//     // logger can be used here if available
//   }

//   try {
//     require('./config/kafka');
//   } catch (err) {
//     // tolerate missing kafka during local tests
//   }
}

module.exports = app;
