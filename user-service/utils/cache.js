
const logger = require('./logger');
const { Counter } = require('prom-client');
let client = null;
// Completely disable Redis during tests
if (process.env.NODE_ENV === "test") {
  // Provide mock functions so userService.cache calls do not fail
  module.exports = {
    setCache: async () => {},
    getCache: async () => null,
    deleteCache: async () => {},
    deleteCacheByPattern: async () => {}
  };
} else {
  const redis = require('redis');
  client = redis.createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    },
    //legacyMode: true // Required for some older redis clients, consider removing if using newer patterns
  });

  client.on('connect', () => logger.info('Connected to Redis cache'));
  client.on('error', (err) => logger.error('Redis Client Error', err));
  client.on('ready', async () => {
    const pong = await client.ping();
    logger.info(`Redis ping response: ${pong}`);
  });
  // Connect to Redis when the module is loaded
  (async () => {
    try {
      await client.connect();
      logger.info('✅ Connected to Redis cache');
    } catch (err) {
      logger.error('Redis connection error:', err);
    }
  })();

  const setCache = async (key, value, expiryInSeconds = 3600) => {
    try {
      if (value === undefined || value === null) {
        logger.warn(`⚠️ Skipping cache set for key ${key} — value is ${value}`);
        return;
      }
      const json = JSON.stringify(value);
      await client.setEx(key, expiryInSeconds, json);
      logger.debug(`💾 Cache set for key: ${key}`);
    } catch (error) {
      logger.error(`Error setting cache for key ${key}:`, error);
    }
  };

  const getCache = async (key) => {
    try {
      const data = await client.get(key);
      if (!data) {
        redisMissCounter.inc();
        logger.debug(`🚫 No cache found for key: ${key}`);
        return null;
      }
      redisHitCounter.inc();

      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch (parseErr) {
        logger.warn(`⚠️ Invalid JSON in cache for key ${key}. Deleting corrupt cache entry.`);
        await client.del(key); // clean bad data
        return null;
      }

      logger.debug(`✅ Cache hit for key: ${key}`);
      return parsed;
    } catch (error) {
      logger.error(`Error getting cache for key ${key}:`, error);
      return null;
    }
  };

  const deleteCacheByPattern = async (pattern) => {
    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
        logger.info(`🧹 Deleted ${keys.length} cache entries for pattern: ${pattern}`);
      }
    } catch (error) {
      logger.error(`Error deleting cache by pattern ${pattern}:`, error);
    }
  };

  const setCacheV1 = async (key, value, expiryInSeconds = 3600) => { // Default 1 hour
    try {
      await client.setEx(key, expiryInSeconds, JSON.stringify(value));
      logger.debug(`Cache set for key: ${key}`);
      logger.info(`🟢 Redis cache set successfully for key: ${key}`);
    } catch (error) {
      logger.error(`Error setting cache for key ${key}:`, error);
    }
  };

  const getCacheV1 = async (key) => {
    try {
      const data = await client.get(key);
      logger.debug(`Cache retrieved for key: ${key}`);
      logger.debug(`####Cache data###: ${JSON.parse(data)}`);
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

  const redisHitCounter = new Counter({
    name: 'redis_cache_hit_total',
    help: 'Total Redis cache hits'
  });
  const redisMissCounter = new Counter({
    name: 'redis_cache_miss_total',
    help: 'Total Redis cache misses'
  });

  module.exports = {
    setCache,
    getCache,
    deleteCache,
    deleteCacheByPattern
  };
}