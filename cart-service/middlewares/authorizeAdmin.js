// middlewares/authorizeAdmin.js
const logger = require('../utils/logger');

module.exports = function authorizeAdmin(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized — user not authenticated'
      });
    }
    // ✅ Check for admin role
    if (req.user.role && req.user.role.toLowerCase() === 'admin') {
      return next();
    }

    logger.warn(`Unauthorized access attempt by user ${req.user.email || req.user.id}`);
    return res.status(403).json({
      success: false,
      message: 'Access denied — Admins only'
    });
  } catch (error) {
    logger.error(`Admin authorization error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Authorization server error'
    });
  }
};
