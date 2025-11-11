const { createConsumer } = require('../config/kafka');
const productQueries = require('../data/productQueries');
const logger = require('../utils/logger');

/**
 * Kafka Consumer for Product Service
 * Handles inventory updates from Order Service
 */

let consumer;
let isRunning = false;

/**
 * Initialize and start consumer
 */
const startConsumer = async () => {
  try {
    consumer = createConsumer('product-service-inventory-group');
    
    await consumer.connect();
    logger.info('✅ Product Kafka consumer connected');

    // Subscribe to inventory events
    await consumer.subscribe({
      topics: ['inventory-events', 'order-events'],
      fromBeginning: false
    });

    isRunning = true;

    // Process messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = JSON.parse(message.value.toString());
          const eventType = value.eventType;
          const data = value.data;

          logger.info(`📥 Received event: ${eventType} from topic: ${topic}`);

          // Route to appropriate handler
          switch (eventType) {
            case 'inventory.update':
              await handleInventoryUpdate(data);
              break;
            
            case 'inventory.restore':
              await handleInventoryRestore(data);
              break;
            
            case 'order.created':
              await handleOrderCreated(data);
              break;
            
            case 'order.cancelled':
              await handleOrderCancelled(data);
              break;
            
            default:
              logger.debug(`Unhandled event type: ${eventType}`);
          }
        } catch (error) {
          logger.error(`❌ Error processing message: ${error.message}`);
          // Don't throw - continue processing other messages
        }
      }
    });

    logger.info('🎧 Product Kafka consumer is listening...');
  } catch (error) {
    logger.error(`❌ Error starting Kafka consumer: ${error.message}`);
    throw error;
  }
};

/**
 * Handle inventory update (decrement stock)
 */
const handleInventoryUpdate = async (data) => {
  try {
    logger.info(`🔄 Processing inventory update for order: ${data.orderId}`);

    if (!data.items || data.items.length === 0) {
      logger.warn('No items in inventory update event');
      return;
    }

    const results = [];

    for (const item of data.items) {
      try {
        // Get current product
        const product = await productQueries.findById(item.productId);

        if (!product) {
          logger.error(`Product not found: ${item.productId}`);
          results.push({
            productId: item.productId,
            success: false,
            error: 'Product not found'
          });
          continue;
        }

        // Calculate new stock
        const newStock = product.stock - item.quantity;

        if (newStock < 0) {
          logger.error(`Insufficient stock for product ${item.productId}. Available: ${product.stock}, Requested: ${item.quantity}`);
          results.push({
            productId: item.productId,
            success: false,
            error: 'Insufficient stock'
          });
          continue;
        }

        // Update stock
        await productQueries.updateStock(item.productId, -item.quantity);

        logger.info(`✅ Stock updated for ${item.productId}: ${product.stock} → ${newStock}`);
        
        results.push({
          productId: item.productId,
          success: true,
          oldStock: product.stock,
          newStock: newStock
        });

        // Check if product is now out of stock
        if (newStock === 0) {
          logger.warn(`⚠️ Product ${item.productId} is now OUT OF STOCK`);
          // TODO: Publish out-of-stock event
        }
      } catch (error) {
        logger.error(`Error updating stock for product ${item.productId}: ${error.message}`);
        results.push({
          productId: item.productId,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info(`✅ Inventory update complete: ${successCount}/${data.items.length} successful`);
  } catch (error) {
    logger.error(`❌ Error handling inventory update: ${error.message}`);
  }
};

/**
 * Handle inventory restoration (increment stock)
 */
const handleInventoryRestore = async (data) => {
  try {
    logger.info(`🔄 Processing inventory restoration for order: ${data.orderId}`);

    if (!data.items || data.items.length === 0) {
      logger.warn('No items in inventory restoration event');
      return;
    }

    const results = [];

    for (const item of data.items) {
      try {
        // Get current product
        const product = await productQueries.findById(item.productId);

        if (!product) {
          logger.error(`Product not found: ${item.productId}`);
          results.push({
            productId: item.productId,
            success: false,
            error: 'Product not found'
          });
          continue;
        }

        // Calculate new stock
        const newStock = product.stock + item.quantity;

        // Update stock
        await productQueries.updateStock(item.productId, item.quantity);

        logger.info(`✅ Stock restored for ${item.productId}: ${product.stock} → ${newStock}`);
        
        results.push({
          productId: item.productId,
          success: true,
          oldStock: product.stock,
          newStock: newStock
        });
      } catch (error) {
        logger.error(`Error restoring stock for product ${item.productId}: ${error.message}`);
        results.push({
          productId: item.productId,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info(`✅ Inventory restoration complete: ${successCount}/${data.items.length} successful`);
  } catch (error) {
    logger.error(`❌ Error handling inventory restoration: ${error.message}`);
  }
};

/**
 * Handle order created event (alternative to inventory.update)
 */
const handleOrderCreated = async (data) => {
  try {
    logger.info(`📦 Processing order created: ${data.orderId}`);
    
    // This is a backup handler in case inventory.update wasn't processed
    // Normally, inventory.update should be used
    if (data.items && data.items.length > 0) {
      logger.debug('Order created event contains items, but inventory.update should handle stock updates');
    }
  } catch (error) {
    logger.error(`❌ Error handling order created: ${error.message}`);
  }
};

/**
 * Handle order cancelled event
 */
const handleOrderCancelled = async (data) => {
  try {
    logger.info(`❌ Processing order cancellation: ${data.orderId}`);
    
    // Inventory restoration is handled by inventory.restore event
    // This is just for logging/analytics
    logger.info(`Order ${data.orderId} cancelled. Inventory restoration handled separately.`);
  } catch (error) {
    logger.error(`❌ Error handling order cancelled: ${error.message}`);
  }
};

/**
 * Stop consumer
 */
const stopConsumer = async () => {
  try {
    if (consumer && isRunning) {
      await consumer.disconnect();
      isRunning = false;
      logger.info('🔌 Product Kafka consumer disconnected');
    }
  } catch (error) {
    logger.error(`❌ Error stopping consumer: ${error.message}`);
  }
};

/**
 * Health check
 */
const healthCheck = () => {
  return {
    running: isRunning,
    service: 'product-kafka-consumer'
  };
};

// Graceful shutdown
process.on('SIGINT', stopConsumer);
process.on('SIGTERM', stopConsumer);

module.exports = {
  startConsumer,
  stopConsumer,
  healthCheck
};