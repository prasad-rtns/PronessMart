const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  logger.error(err.stack);

  let error = { ...err };
  error.message = err.message;

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error.message = message;
    error.statusCode = 404;
  }

  // Mongoose duplicate key
  if (err && err.code === 11000) {
    // Mongo duplicate key
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'field';
    const value = err.keyValue ? Object.values(err.keyValue)[0] : '';
    return res.status(400).json({
      success: false,
      message: `Duplicate field value entered: ${field} = ${value}`
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error.message = message;
    error.statusCode = 400;
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;