const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'order-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const producer = kafka.producer({
  allowAutoTopicCreation: true,
  transactionTimeout: 30000
});

let isConnected = false;

/**
 * Connect Kafka producer
 */
const connectProducer = async () => {
  try {
    if (!isConnected) {
      await producer.connect();
      isConnected = true;
      logger.info('✅ Kafka producer connected');
    }
  } catch (error) {
    logger.error(`❌ Error connecting Kafka producer: ${error.message}`);
    throw error;
  }
};

/**
 * Publish order event to multiple topics
 */
const publishOrderEvent = async (eventType, data) => {
  try {
    if (!isConnected) {
      logger.info(`🔄 Kafka disconnected, reconnecting for event: ${eventType}`);
      await connectProducer();
    }

    // Determine topic based on event type
    const topic = getTopicForEvent(eventType);

    logger.info(`📤 Publishing ${eventType} to topic: ${topic}`);

    await producer.send({
      topic: topic,
      messages: [
        {
          key: data.orderId || data.userId,
          value: JSON.stringify({
            eventType,
            data,
            timestamp: data.timestamp || new Date().toISOString()
          }),
          headers: {
            'event-type': eventType,
            'service': 'order-service',
            'version': '1.0'
          }
        }
      ]
    });

    logger.info(`✅ Published ${eventType} for order ${data.orderId || 'N/A'}`);
  } catch (error) {
    logger.error(`❌ Error publishing ${eventType}: ${error.message}`);
    throw error;
  }
};

/**
 * Publish multiple events in a batch
 */
const publishBatchEvents = async (events) => {
  try {
    if (!isConnected) {
      await connectProducer();
    }

    const messages = events.map(event => ({
      topic: getTopicForEvent(event.eventType),
      messages: [{
        key: event.data.orderId || event.data.userId,
        value: JSON.stringify({
          eventType: event.eventType,
          data: event.data,
          timestamp: event.data.timestamp || new Date().toISOString()
        }),
        headers: {
          'event-type': event.eventType,
          'service': 'order-service',
          'version': '1.0'
        }
      }]
    }));

    await producer.sendBatch({
      topicMessages: messages
    });

    logger.info(`✅ Published batch of ${events.length} events`);
  } catch (error) {
    logger.error(`❌ Error publishing batch events: ${error.message}`);
    throw error;
  }
};

/**
 * Get appropriate topic for event type
 */
const getTopicForEvent = (eventType) => {
  const topicMap = {
    // Order events
    'order.created': 'order-events',
    'order.updated': 'order-events',
    'order.cancelled': 'order-events',
    'order.status.updated': 'order-events',
    'order.analytics': 'analytics-events',
    
    // Inventory events (for product service)
    'inventory.update': 'inventory-events',
    'inventory.restore': 'inventory-events',
    'inventory.reserved': 'inventory-events',
    
    // Cart events (for cart service)
    'cart.clear': 'cart-events',
    'cart.checkout': 'cart-events',
    
    // Payment events
    'payment.initiated': 'payment-events',
    'payment.completed': 'payment-events',
    'payment.failed': 'payment-events',
    
    // Notification events
    'notification.order.created': 'notification-events',
    'notification.order.shipped': 'notification-events',
    'notification.order.delivered': 'notification-events'
  };

  return topicMap[eventType] || 'order-events';
};

/**
 * Publish inventory decrement event
 */
const publishInventoryUpdate = async (orderId, orderNumber, items) => {
  return await publishOrderEvent('inventory.update', {
    orderId,
    orderNumber,
    action: 'decrement',
    items: items.map(item => ({
      productId: item.productId,
      sku: item.sku,
      quantity: item.quantity,
      operation: 'subtract'
    }))
  });
};

/**
 * Publish inventory restoration event (for cancellations)
 */
const publishInventoryRestore = async (orderId, orderNumber, items, reason = 'order_cancelled') => {
  return await publishOrderEvent('inventory.restore', {
    orderId,
    orderNumber,
    action: 'increment',
    items: items.map(item => ({
      productId: item.productId,
      sku: item.sku,
      quantity: item.quantity,
      operation: 'add'
    })),
    reason
  });
};

/**
 * Publish cart clear event
 */
const publishCartClear = async (orderId, orderNumber, userId, reason = 'order_created') => {
  return await publishOrderEvent('cart.clear', {
    orderId,
    orderNumber,
    userId,
    reason
  });
};

/**
 * Disconnect producer
 */
const disconnect = async () => {
  try {
    if (isConnected) {
      await producer.disconnect();
      isConnected = false;
      logger.info('🔌 Kafka producer disconnected');
    }
  } catch (error) {
    logger.error(`❌ Error disconnecting Kafka producer: ${error.message}`);
  }
};

/**
 * Health check
 */
const healthCheck = () => {
  return {
    connected: isConnected,
    service: 'order-service-producer'
  };
};

// Graceful shutdown
process.on('SIGINT', disconnect);
process.on('SIGTERM', disconnect);

module.exports = {
  connectProducer,
  publishOrderEvent,
  publishBatchEvents,
  publishInventoryUpdate,
  publishInventoryRestore,
  publishCartClear,
  disconnect,
  healthCheck
};