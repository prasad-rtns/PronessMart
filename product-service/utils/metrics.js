// utils/metrics.js
const client = require('prom-client');

// Default registry
const register = new client.Registry();

// Collect default system metrics (CPU, memory, event loop lag, etc.)
client.collectDefaultMetrics({ register });

// Custom counters for logs
const infoCounter = new client.Counter({
  name: 'app_info_logs_total',
  help: 'Count of info-level logs',
  labelNames: ['service']
});

const errorCounter = new client.Counter({
  name: 'app_error_logs_total',
  help: 'Count of error-level logs',
  labelNames: ['service']
});

register.registerMetric(infoCounter);
register.registerMetric(errorCounter);

module.exports = { register, infoCounter, errorCounter };
