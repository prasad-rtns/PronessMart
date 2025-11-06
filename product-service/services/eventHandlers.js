const { subscribe } = require('../config/kafka');
const logger = require('../utils/logger');

// Topics to subscribe to
const TOPICS = {
  ORDER_CREATED: 'order.created',
  ORDER_CANCELLED: 'order.cancelled',
  PAYMENT_COMPLETED: 'payment.completed',
  INVENTORY_SYNC: 'inventory.sync.request'
};

class EventHandlers {
  async initialize() {
    try {
      // Subscribe to relevant topics
      await subscribe(
        [
          TOPICS.ORDER_CREATED,
          TOPICS.ORDER_CANCELLED,
          TOPICS.INVENTORY_SYNC
        ],
        this.handleEvent.bind(this)
      );

      logger.info('Event handlers initialized and subscribed to topics');
    } catch (error) {
      logger.error(`Error initializing event handlers: ${error.message}`);
    }
  }

  async handleEvent({ topic, key, value }) {
    try {
      switch (topic) {
        case TOPICS.ORDER_CREATED:
          await this.handleOrderCreated(value);
          break;
        case TOPICS.ORDER_CANCELLED:
          await this.handleOrderCancelled(value);
          break;
        case TOPICS.INVENTORY_SYNC:
          await this.handleInventorySync(value);
          break;
        default:
          logger.warn(`Unhandled topic: ${topic}`);
      }
    } catch (error) {
      logger.error(`Error handling event from ${topic}: ${error.message}`);
    }
  }

  // Handle order created event - reserve inventory
  async handleOrderCreated(orderData) {
    try {
      logger.info(`Processing order created: ${orderData.orderId}`);

      const productQueries = require('../data/productQueries');
      
      for (const item of orderData.items) {
        const product = await productQueries.getProductById(item.productId);
        
        if (!product) {
          logger.error(`Product not found: ${item.productId}`);
          continue;
        }

        // Find inventory for the order's region
        const inventoryItem = product.inventory.find(
          inv => inv.region === orderData.region
        );

        if (inventoryItem && inventoryItem.quantity >= item.quantity) {
          // Deduct inventory
          const newQuantity = inventoryItem.quantity - item.quantity;
          
          await productQueries.updateInventory(
            item.productId,
            orderData.region,
            newQuantity,
            inventoryItem.warehouse
          );

          logger.info(
            `Inventory reserved for product ${item.productId}: ${item.quantity} units`
          );
        } else {
          logger.warn(
            `Insufficient inventory for product ${item.productId} in region ${orderData.region}`
          );
        }
      }
    } catch (error) {
      logger.error(`Error handling order created: ${error.message}`);
      throw error;
    }
  }

  // Handle order cancelled event - restore inventory
  async handleOrderCancelled(orderData) {
    try {
      logger.info(`Processing order cancelled: ${orderData.orderId}`);

      const productQueries = require('../data/productQueries');
      
      for (const item of orderData.items) {
        const product = await productQueries.getProductById(item.productId);
        
        if (!product) {
          logger.error(`Product not found: ${item.productId}`);
          continue;
        }

        // Find inventory for the order's region
        const inventoryItem = product.inventory.find(
          inv => inv.region === orderData.region
        );

        if (inventoryItem) {
          // Restore inventory
          const newQuantity = inventoryItem.quantity + item.quantity;
          
          await productQueries.updateInventory(
            item.productId,
            orderData.region,
            newQuantity,
            inventoryItem.warehouse
          );

          logger.info(
            `Inventory restored for product ${item.productId}: ${item.quantity} units`
          );
        }
      }
    } catch (error) {
      logger.error(`Error handling order cancelled: ${error.message}`);
      throw error;
    }
  }

  // Handle inventory sync request
  async handleInventorySync(syncData) {
    try {
      logger.info(`Processing inventory sync request for region: ${syncData.region}`);

      const productQueries = require('../data/productQueries');
      const { publishEvent } = require('../utils/kafka');

      // Get all products with inventory data
      const products = await productQueries.getProducts({
        region: syncData.region,
        limit: 1000
      });

      // Prepare inventory data
      const inventoryData = products.products.map(product => ({
        productId: product._id,
        sku: product.sku,
        name: product.name,
        inventory: product.inventory.filter(inv => inv.region === syncData.region)
      }));

      // Publish inventory sync response
      await publishEvent('inventory.sync.response', {
        key: syncData.requestId,
        value: {
          requestId: syncData.requestId,
          region: syncData.region,
          products: inventoryData,
          timestamp: new Date().toISOString()
        }
      });

      logger.info(`Inventory sync completed for region: ${syncData.region}`);
    } catch (error) {
      logger.error(`Error handling inventory sync: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new EventHandlers();