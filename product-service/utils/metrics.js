const client = require('prom-client');

// Create a new registry
const register = new client.Registry();

// Default system metrics (CPU, memory, event loop lag, etc.)
client.collectDefaultMetrics({ register });

// Define custom log counters
const infoCounter = new client.Counter({
  name: 'service_info_logs_total',
  help: 'Total number of info-level logs',
  labelNames: ['service']
});

const errorCounter = new client.Counter({
  name: 'service_error_logs_total',
  help: 'Total number of error-level logs',
  labelNames: ['service']
});

// Register metrics
register.registerMetric(infoCounter);
register.registerMetric(errorCounter);

module.exports = { register, infoCounter, errorCounter };
