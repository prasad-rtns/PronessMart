// utils/logger.js
const fs = require('fs');
const path = require('path');
const winston = require('winston');
//const { infoCounter, errorCounter } = require('./metrics');

// ✅ Define service name early
const serviceName = process.env.SERVICE_NAME || 'product-service';
const logLevel = process.env.LOG_LEVEL || 'info';

// ✅ Ensure the logs directory exists
const logDir = path.join(__dirname, '../logs');
console.log(`Log directory: ${logDir}`);
try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  fs.chmodSync(logDir, 0o777);
  fs.accessSync(logDir, fs.constants.W_OK);
} catch (err) {
  console.error(`[Logger Init] Cannot access log directory ${logDir}:`, err);
}
// --- Console format ---
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    info =>
      `${info.timestamp} ${info.level}: ${info.message}${
        info.stack ? '\n' + info.stack : ''
      }`
  )
);

// --- File format ---
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// ---- Base Logger ----
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: process.env.SERVICE_NAME || 'product-service' },
  transports: [
    new winston.transports.Console({
      format: consoleFormat // Use specific format for console
    }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' })
  ]
});



// ---- Development Console Enhancement ----
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  );
}

// ---- Logger Factory for Custom Use ----
/**
 * Creates a new Winston logger instance.
 * @param {string} name - The name of the logger (e.g., 'app', 'db', 'audit').
 * @param {string} fileName - The base filename for logs (e.g., 'combined.log', 'db.log').
 * @param {string} [level] - Optional log level for this specific logger. Defaults to global logLevel.
 * @returns {winston.Logger} A Winston logger instance.
 */
const createLogger = (name, fileName, level = logLevel) => {
  return winston.createLogger({
    level: level,
    format: fileFormat, // Default format for file transports
    defaultMeta: { service: name }, // Add a default metadata field
    transports: [
      new winston.transports.File({ filename: `logs/${fileName}` }),
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }) // All errors go to a central error log
    ],
    exceptionHandlers: [
      new winston.transports.File({ filename: 'logs/exceptions.log' })
    ],
    rejectionHandlers: [ // Handle unhandled promise rejections
      new winston.transports.File({ filename: 'logs/rejections.log' })
    ]
  });
};

module.exports = logger;
module.exports.createLogger = createLogger;
