const winston = require('winston');

const logLevel = process.env.LOG_LEVEL || 'info';

// --- Common Log Formats ---
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message} ${info.stack ? '\n' + info.stack : ''}`)
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: process.env.SERVICE_NAME || 'user-service' },
  transports: [
    new winston.transports.Console({
      format: consoleFormat // Use specific format for console
    }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' })
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }), // Include stack trace for errors
  winston.format.splat(), // Handles string interpolation
  winston.format.json() // Output as JSON for structured logging
);

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

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
module.exports.createLogger = createLogger; // Export the factory function for custom loggers