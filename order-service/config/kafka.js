const { Kafka, logLevel } = require('kafkajs');
const logger = require('../utils/logger');

/**
 * Kafka Configuration
 * Configures Kafka client for the Order Service
 */

// Get Kafka brokers from environment
const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

// Create Kafka instance
const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'order-service',
  brokers: brokers,
  logLevel: logLevel.ERROR,
  retry: {
    initialRetryTime: 100,
    retries: 8
  },
  connectionTimeout: 3000,
  requestTimeout: 30000
});

/**
 * Custom logger for Kafka
 */
const kafkaLogger = {
  info: (message) => logger.info(`[Kafka] ${message}`),
  error: (message) => logger.error(`[Kafka] ${message}`),
  warn: (message) => logger.warn(`[Kafka] ${message}`),
  debug: (message) => logger.debug(`[Kafka] ${message}`)
};

/**
 * Topics configuration
 */
const TOPICS = {
  ORDER_EVENTS: 'order-events',
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_STATUS_CHANGED: 'order.status.changed',
  PAYMENT_EVENTS: 'payment-events',
  INVENTORY_EVENTS: 'inventory-events'
};

/**
 * Create Kafka producer
 */
const createProducer = () => {
  const producer = kafka.producer({
    allowAutoTopicCreation: true,
    transactionTimeout: 30000
  });

  return producer;
};

/**
 * Create Kafka consumer
 */
const createConsumer = (groupId) => {
  const consumer = kafka.consumer({
    groupId: groupId || process.env.KAFKA_GROUP_ID || 'order-service-group',
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    allowAutoTopicCreation: true
  });

  return consumer;
};

/**
 * Create Kafka admin client
 */
const createAdmin = () => {
  return kafka.admin();
};

/**
 * Initialize topics
 * Creates topics if they don't exist
 */
const initializeTopics = async () => {
  const admin = createAdmin();

  try {
    await admin.connect();
    logger.info('Kafka admin connected');

    const existingTopics = await admin.listTopics();
    const topicsToCreate = Object.values(TOPICS).filter(
      topic => !existingTopics.includes(topic)
    );

    if (topicsToCreate.length > 0) {
      await admin.createTopics({
        topics: topicsToCreate.map(topic => ({
          topic,
          numPartitions: 3,
          replicationFactor: 1,
          configEntries: [
            { name: 'retention.ms', value: '604800000' }, // 7 days
            { name: 'cleanup.policy', value: 'delete' }
          ]
        }))
      });

      logger.info(`Created topics: ${topicsToCreate.join(', ')}`);
    } else {
      logger.info('All topics already exist');
    }

    await admin.disconnect();
  } catch (error) {
    logger.error(`Error initializing Kafka topics: ${error.message}`);
    await admin.disconnect();
    throw error;
  }
};

/**
 * Health check for Kafka connection
 */
const healthCheck = async () => {
  const admin = createAdmin();

  try {
    await admin.connect();
    const cluster = await admin.describeCluster();
    await admin.disconnect();

    return {
      status: 'UP',
      brokers: cluster.brokers.length,
      controller: cluster.controller
    };
  } catch (error) {
    logger.error(`Kafka health check failed: ${error.message}`);
    return {
      status: 'DOWN',
      error: error.message
    };
  }
};

/**
 * Graceful shutdown
 */
const disconnect = async (producer, consumer) => {
  try {
    if (producer) {
      await producer.disconnect();
      logger.info('Kafka producer disconnected');
    }

    if (consumer) {
      await consumer.disconnect();
      logger.info('Kafka consumer disconnected');
    }
  } catch (error) {
    logger.error(`Error disconnecting Kafka: ${error.message}`);
  }
};

module.exports = {
  kafka,
  TOPICS,
  createProducer,
  createConsumer,
  createAdmin,
  initializeTopics,
  healthCheck,
  disconnect,
  kafkaLogger
};