const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

const kafka = new Kafka({
  clientId: 'product-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

/**
 * Creates a new Kafka consumer instance
 * @param {string} groupId - The consumer group ID
 */
const createConsumer = (groupId) => {
  if (!groupId) {
    throw new Error('A consumer group ID is required.');
  }
  const consumer = kafka.consumer({
    groupId: groupId || process.env.KAFKA_GROUP_ID || 'order-service-group',
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    allowAutoTopicCreation: true
  });

  return consumer;
};

const producer = kafka.producer({
  allowAutoTopicCreation: true,
  transactionTimeout: 30000
});

const consumer = kafka.consumer({
  groupId: 'product-service-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000
});

let producerConnected = false;
let consumerConnected = false;

// Connect producer
const connectProducer = async () => {
  if (!producerConnected) {
    try {
      await producer.connect();
      producerConnected = true;
      logger.info('Kafka producer connected');
    } catch (error) {
      logger.error(`Kafka producer connection error: ${error.message}`);
      throw error;
    }
  }
};

// Connect consumer
const connectConsumer = async () => {
  if (!consumerConnected) {
    try {
      await consumer.connect();
      consumerConnected = true;
      logger.info('Kafka consumer connected');
    } catch (error) {
      logger.error(`Kafka consumer connection error: ${error.message}`);
      throw error;
    }
  }
};

// Disconnect
const disconnect = async () => {
  try {
    if (producerConnected) {
      await producer.disconnect();
      producerConnected = false;
    }
    if (consumerConnected) {
      await consumer.disconnect();
      consumerConnected = false;
    }
    logger.info('Kafka connections closed');
  } catch (error) {
    logger.error(`Kafka disconnect error: ${error.message}`);
  }
};

// Publish event
const publishEvent = async (topic, message) => {
  try {
    await connectProducer();
    
    const result = await producer.send({
      topic,
      messages: [{
        key: message.key || null,
        value: JSON.stringify(message.value),
        headers: message.headers || {},
        timestamp: Date.now().toString()
      }]
    });
    
    logger.info(`Event published to ${topic}`, { 
      topic, 
      key: message.key,
      partition: result[0].partition 
    });
    
    return result;
  } catch (error) {
    logger.error(`Error publishing event to ${topic}: ${error.message}`);
    throw error;
  }
};

// Subscribe to topic
const subscribe = async (topics, handler) => {
  try {
    await connectConsumer();
    
    await consumer.subscribe({ 
      topics: Array.isArray(topics) ? topics : [topics],
      fromBeginning: false 
    });
    
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = JSON.parse(message.value.toString());
          const key = message.key ? message.key.toString() : null;
          
          logger.info(`Received message from ${topic}`, { topic, partition, key });
          
          await handler({ topic, partition, key, value });
        } catch (error) {
          logger.error(`Error processing message from ${topic}: ${error.message}`);
        }
      }
    });
    
    logger.info(`Subscribed to topics: ${topics}`);
  } catch (error) {
    logger.error(`Error subscribing to topics: ${error.message}`);
    throw error;
  }
};

// Handle graceful shutdown
process.on('SIGINT', disconnect);
process.on('SIGTERM', disconnect);

module.exports = {
  kafka,
  producer,
  consumer,
  connectProducer,
  connectConsumer,
  createConsumer,
  disconnect,
  publishEvent,
  subscribe
};