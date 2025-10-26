const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'order-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
});

const producer = kafka.producer();

let isConnected = false;

const connectProducer = async () => {
  try {
    await producer.connect();
    isConnected = true;
    logger.info('Kafka producer connected');
  } catch (error) {
    logger.error(`Error connecting Kafka producer: ${error.message}`);
    throw error;
  }
};

const publishOrderEvent = async (eventType, data) => {
  try {
    if (!isConnected) {
      await connectProducer();
    }

    await producer.send({
      topic: 'order-events',
      messages: [
        {
          key: data.orderId,
          value: JSON.stringify({
            eventType,
            data,
            timestamp: new Date().toISOString()
          })
        }
      ]
    });

    logger.info(`Published event ${eventType} for order ${data.orderId}`);
  } catch (error) {
    logger.error(`Error publishing order event: ${error.message}`);
    throw error;
  }
};

const disconnect = async () => {
  try {
    await producer.disconnect();
    isConnected = false;
    logger.info('Kafka producer disconnected');
  } catch (error) {
    logger.error(`Error disconnecting Kafka producer: ${error.message}`);
  }
};

module.exports = {
  connectProducer,
  publishOrderEvent,
  disconnect
};