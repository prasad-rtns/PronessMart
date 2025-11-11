const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      // attach user info to request
      req.user = { id: decoded.id };
      logger.debug(`Authenticated user: ${decoded.id}`);
    } else {
      // No token = treat as guest
      req.user = null;
      logger.debug('Guest user - no token provided');
    }

    next();
  } catch (err) {
    // If token invalid, still allow as guest
    logger.warn(`Invalid or missing token, continuing as guest: ${err.message}`);
    req.user = null;
    next();
  }
};
