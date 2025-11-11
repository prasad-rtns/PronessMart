const { Kafka } = require('kafkajs');
const cartQueries = require('../data/cartQueries');
const logger = require('../utils/logger');

/**
 * Kafka Consumer for Cart Service
 * Handles cart clearing after successful orders
 */

const kafka = new Kafka({
  clientId: 'cart-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

let consumer;
let isRunning = false;

/**
 * Initialize and start consumer
 */
const startConsumer = async () => {
  try {
    consumer = kafka.consumer({
      groupId: 'cart-service-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });
    
    await consumer.connect();
    logger.info('✅ Cart Kafka consumer connected');

    // Subscribe to cart events
    await consumer.subscribe({
      topics: ['cart-events', 'order-events'],
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
            case 'cart.clear':
              await handleCartClear(data);
              break;
            
            case 'cart.checkout':
              await handleCartCheckout(data);
              break;
            
            case 'order.created':
              await handleOrderCreated(data);
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

    logger.info('🎧 Cart Kafka consumer is listening...');
  } catch (error) {
    logger.error(`❌ Error starting Kafka consumer: ${error.message}`);
    throw error;
  }
};

/**
 * Handle cart clear event
 */
const handleCartClear = async (data) => {
  try {
    logger.info(`🗑️ Processing cart clear for user: ${data.userId}`);

    if (!data.userId) {
      logger.error('No userId in cart clear event');
      return;
    }

    // Clear the user's cart
    const cart = await cartQueries.clearCart(data.userId);

    if (cart) {
      logger.info(`✅ Cart cleared for user ${data.userId}`);
      
      // Update cart status to converted if reason is order_created
      if (data.reason === 'order_created' && data.orderId) {
        await cartQueries.updateStatus(data.userId, 'converted');
        logger.info(`✅ Cart status updated to 'converted' for user ${data.userId}`);
      }
    } else {
      logger.warn(`Cart not found or already empty for user ${data.userId}`);
    }
  } catch (error) {
    logger.error(`❌ Error handling cart clear: ${error.message}`);
    // Log error but don't throw - cart clearing failure shouldn't affect order
  }
};

/**
 * Handle cart checkout event
 */
const handleCartCheckout = async (data) => {
  try {
    logger.info(`🛒 Processing cart checkout for user: ${data.userId}`);

    if (!data.userId) {
      logger.error('No userId in cart checkout event');
      return;
    }

    // Mark cart as being checked out
    await cartQueries.updateStatus(data.userId, 'checkout');
    logger.info(`✅ Cart status updated to 'checkout' for user ${data.userId}`);
  } catch (error) {
    logger.error(`❌ Error handling cart checkout: ${error.message}`);
  }
};

/**
 * Handle order created event (backup handler)
 */
const handleOrderCreated = async (data) => {
  try {
    logger.info(`📦 Processing order created: ${data.orderId} for user: ${data.userId}`);

    // This is a backup handler in case cart.clear wasn't processed
    // Try to clear the cart
    if (data.userId) {
      try {
        await cartQueries.clearCart(data.userId);
        await cartQueries.updateStatus(data.userId, 'converted');
        logger.info(`✅ Cart cleared and converted for user ${data.userId} (backup handler)`);
      } catch (error) {
        logger.error(`Error clearing cart in backup handler: ${error.message}`);
      }
    }
  } catch (error) {
    logger.error(`❌ Error handling order created: ${error.message}`);
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
      logger.info('🔌 Cart Kafka consumer disconnected');
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
    service: 'cart-kafka-consumer'
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