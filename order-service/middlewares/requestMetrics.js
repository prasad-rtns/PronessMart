const client = require('prom-client');

// Counter → REQUIRED for RPS
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['service', 'method', 'route', 'status_code']
});

// Histogram → Response time
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['service', 'method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 1, 2, 3, 5]
});

client.register.registerMetric(httpRequestsTotal);
client.register.registerMetric(httpRequestDuration);

module.exports = (req, res, next) => {
  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    const labels = {
      service: 'product-service',
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode
    };

    httpRequestsTotal.inc(labels);   // 🔥 COUNTER
    end(labels);                     // ⏱ Histogram
  });

  next();
};