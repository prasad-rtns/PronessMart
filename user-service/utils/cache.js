
const redis = require('redis');
const logger = require('./logger');

const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  },
  legacyMode: true // Required for some older redis clients, consider removing if using newer patterns
});

client.on('connect', () => logger.info('Connected to Redis cache'));
client.on('error', (err) => logger.error('Redis Client Error', err));

// Connect to Redis when the module is loaded
(async () => {
  await client.connect();
})();


const setCache = async (key, value, expiryInSeconds = 3600) => { // Default 1 hour
  try {
    await client.setEx(key, expiryInSeconds, JSON.stringify(value));
    logger.info(`Cache set for key: ${key}`);
  } catch (error) {
    logger.error(`Error setting cache for key ${key}:`, error);
  }
};

const getCache = async (key) => {
  try {
    const data = await client.get(key);
    logger.info(`Cache retrieved for key: ${key}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Error getting cache for key ${key}:`, error);
    return null;
  }
};

const deleteCache = async (key) => {
  try {
    await client.del(key);
    logger.info(`Cache deleted for key: ${key}`);
  } catch (error) {
    logger.error(`Error deleting cache for key ${key}:`, error);
  }
};

module.exports = {
  setCache,
  getCache,
  deleteCache
};
