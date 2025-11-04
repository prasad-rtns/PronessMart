const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

let pool;

const connectDB = async () => {
  try {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test connection
    const connection = await pool.getConnection();
    logger.info(`MySQL Connected: ${process.env.MYSQL_HOST}`);
    connection.release();

    // Create tables if they don't exist
    await createTables();
  } catch (error) {
    logger.error(`Error connecting to MySQL: ${error.message}`);
    process.exit(1);
  }
};

const createTables = async () => {
  const createOrdersTable = `
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      quote_id VARCHAR(255) NOT NULL,
      order_number VARCHAR(50) UNIQUE NOT NULL,
      status ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
      subtotal DECIMAL(10, 2) NOT NULL,
      discount DECIMAL(10, 2) DEFAULT 0,
      shipping_cost DECIMAL(10, 2) DEFAULT 0,
      tax DECIMAL(10, 2) DEFAULT 0,
      total DECIMAL(10, 2) NOT NULL,
      payment_method VARCHAR(50),
      payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
      shipping_address JSON,
      billing_address JSON,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_order_number (order_number),
      INDEX idx_status (status),
      INDEX idx_created_at (created_at)
    )
  `;

  const createOrderItemsTable = `
    CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(36) NOT NULL,
      product_id VARCHAR(255) NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      sku VARCHAR(100),
      price DECIMAL(10, 2) NOT NULL,
      quantity INT NOT NULL,
      subtotal DECIMAL(10, 2) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      INDEX idx_order_id (order_id),
      INDEX idx_product_id (product_id)
    )
  `;

  try {
    await pool.query(createOrdersTable);
    await pool.query(createOrderItemsTable);
    logger.info('Database tables created successfully');
  } catch (error) {
    logger.error(`Error creating tables: ${error.message}`);
    throw error;
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return pool;
};

module.exports = {
  connectDB,
  getPool
};