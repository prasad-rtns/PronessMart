# Integration Service Development Guide

## 1. Purpose

The `services-integration` stack is the shared infrastructure layer used by application developers for cache, event streaming, and observability.

It is not an application microservice with business APIs. It is a Docker Swarm stack defined in `docker-stack.yml` and deployed to the integration server configured in `.env.prod`.

Developers use this service to:

- Store and read shared cache data through Redis.
- Publish and consume asynchronous domain events through Kafka.
- Inspect Kafka topics, partitions, messages, and consumer groups through Kafka UI.
- Expose service metrics from Node.js services through `/metrics`.
- View platform and service metrics through Prometheus and Grafana.
- Validate end-to-end service behavior across User, Product, Cart, and Order services.

## 2. Runtime Scope

Stack name:

```text
services-integration
```

Integration server:

```text
172.20.104.100
```

Remote deployment root:

```text
/tmp/services-integration
```

Shared Docker network:

```text
ecommerce-network
```

The network is attachable, so application containers can connect to the same overlay network and resolve stack services by DNS name.

## 3. Service Inventory For Developers

| Capability | Service | Internal Address | External Address | Developer Use |
| --- | --- | --- | --- | --- |
| Cache | `redis` | `redis:6379` | `172.20.104.100:6379` | Cache user, product, cart, auth, and lookup data |
| Kafka broker 1 | `kafka-1` | `kafka-1:29092` | `172.20.104.100:9092` | Kafka bootstrap broker |
| Kafka broker 2 | `kafka-2` | `kafka-2:29093` | `172.20.104.100:9093` | Kafka bootstrap broker |
| Kafka broker 3 | `kafka-3` | `kafka-3:29094` | `172.20.104.100:9094` | Kafka bootstrap broker |
| Kafka UI | `kafka-ui` | `kafka-ui:8080` | `http://172.20.104.100:8090` | Topic, message, partition, and consumer-group inspection |
| Prometheus | `prometheus` | `prometheus:9090` | `http://172.20.104.100:9090/prometheus/` | Metrics target and alert inspection |
| Grafana | `grafana` | `grafana:3000` | `http://172.20.104.100:3030` | Dashboards |
| Node Exporter | `node-exporter` | `node-exporter:9100` | `172.20.104.100:9100` | Host metrics |
| cAdvisor | `cadvisor` | `cadvisor:8080` | `http://172.20.104.100:8081` | Container metrics |

## 4. Required Application Environment Variables

Every application service that uses this integration stack should use these environment variables.

When the application service runs inside the same Docker network:

```env
REDIS_HOST=redis
REDIS_PORT=6379
ENABLE_KAFKA=true
KAFKA_BROKERS=kafka-1:29092,kafka-2:29093,kafka-3:29094
KAFKA_CLIENT_ID=<service-name>
KAFKA_GROUP_ID=<service-name>-group
```

When the application service runs from a developer machine outside Docker:

```env
REDIS_HOST=172.20.104.100
REDIS_PORT=6379
ENABLE_KAFKA=true
KAFKA_BROKERS=172.20.104.100:9092,172.20.104.100:9093,172.20.104.100:9094
KAFKA_CLIENT_ID=<service-name>
KAFKA_GROUP_ID=<service-name>-group
```

Use internal broker names only from containers connected to `ecommerce-network`. Use external `172.20.104.100` broker addresses from laptops, servers, or processes outside that Docker network.

## 5. Using This Service From Other Applications

Any other application can use `services-integration` as a shared infrastructure dependency. The other application does not need to be inside this repository. It only needs network access to the integration server or access to the same Docker Swarm overlay network.

### 5.1 Decide The Connection Mode

Use one of these modes.

| Application Runtime | Redis Address | Kafka Brokers | When To Use |
| --- | --- | --- | --- |
| Application runs on developer laptop | `172.20.104.100:6379` | `172.20.104.100:9092,172.20.104.100:9093,172.20.104.100:9094` | Local development against shared integration services |
| Application runs on another server | `172.20.104.100:6379` | `172.20.104.100:9092,172.20.104.100:9093,172.20.104.100:9094` | External application integration |
| Application runs as container on `ecommerce-network` | `redis:6379` | `kafka-1:29092,kafka-2:29093,kafka-3:29094` | Docker-to-Docker integration inside the shared network |
| Application runs in the same Swarm stack/network | `redis:6379` | `kafka-1:29092,kafka-2:29093,kafka-3:29094` | Production-like service-to-service integration |

Use external addresses when the application cannot resolve Docker service names. Use internal addresses only when the application container is attached to `ecommerce-network`.

### 5.2 Add Configuration To The Other Application

Add these variables to the other application's `.env`, container environment, Helm values, pipeline variables, or deployment manifest.

For external applications:

```env
INTEGRATION_SERVICE_HOST=172.20.104.100
REDIS_HOST=172.20.104.100
REDIS_PORT=6379
KAFKA_BROKERS=172.20.104.100:9092,172.20.104.100:9093,172.20.104.100:9094
KAFKA_CLIENT_ID=<other-application-name>
KAFKA_GROUP_ID=<other-application-name>-group
```

For containers on the shared Docker network:

```env
REDIS_HOST=redis
REDIS_PORT=6379
KAFKA_BROKERS=kafka-1:29092,kafka-2:29093,kafka-3:29094
KAFKA_CLIENT_ID=<other-application-name>
KAFKA_GROUP_ID=<other-application-name>-group
```

Use a unique `KAFKA_CLIENT_ID` per application and a unique `KAFKA_GROUP_ID` per consuming responsibility. Do not reuse another service's consumer group unless the new application is intentionally sharing the same workload.

### 5.3 Connect To Redis From Another Application

Use Redis for cache, short-lived lookup data, idempotency keys, locks with expiry, and temporary workflow state. Do not use this Redis instance as the only source of truth for business records.

Node.js example:

```javascript
const redis = require('redis');

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT || 6379)
  }
});

redisClient.on('error', (error) => {
  console.error('Redis error', error);
});

await redisClient.connect();

await redisClient.setEx('myapp:user:1001', 300, JSON.stringify({ name: 'Demo User' }));
const cachedUser = await redisClient.get('myapp:user:1001');
```

Recommended key format for external applications:

```text
<application-name>:<domain>:<id>
```

Examples:

```text
billing-service:invoice:INV-1001
notification-service:template:welcome
payment-service:idempotency:PAY-9001
```

### 5.4 Publish Kafka Events From Another Application

Use Kafka when another application needs to notify this ecosystem about a business event, or when it wants other services to consume its own domain events.

Node.js producer example:

```javascript
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID,
  brokers: process.env.KAFKA_BROKERS.split(',')
});

const producer = kafka.producer({ allowAutoTopicCreation: true });
await producer.connect();

await producer.send({
  topic: 'payment-events',
  messages: [
    {
      key: 'order-1001',
      value: JSON.stringify({
        eventType: 'payment.completed',
        data: {
          paymentId: 'PAY-9001',
          orderId: 'order-1001',
          amount: 1499,
          status: 'completed'
        },
        timestamp: new Date().toISOString()
      }),
      headers: {
        service: process.env.KAFKA_CLIENT_ID,
        version: '1.0',
        'event-type': 'payment.completed'
      }
    }
  ]
});
```

Before publishing a new event type, agree on:

- Topic name.
- Event type.
- Message key.
- Payload fields.
- Required headers.
- Owning application.
- Consumer behavior.
- Retry and failure handling.

### 5.5 Consume Kafka Events In Another Application

Use a stable consumer group for each application responsibility.

Node.js consumer example:

```javascript
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID,
  brokers: process.env.KAFKA_BROKERS.split(',')
});

const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID
});

await consumer.connect();
await consumer.subscribe({
  topics: ['order-events', 'payment-events'],
  fromBeginning: false
});

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const event = JSON.parse(message.value.toString());

    switch (event.eventType) {
      case 'order.created':
        await handleOrderCreated(event.data);
        break;
      case 'payment.completed':
        await handlePaymentCompleted(event.data);
        break;
      default:
        console.log(`Unhandled event type: ${event.eventType}`);
    }
  }
});
```

Consumer rules:

- Keep handlers idempotent.
- Store processed event IDs when duplicate processing would be harmful.
- Commit offsets only after successful processing.
- Use a new consumer group for replay or testing.
- Use the existing shared group only when the application is scaling the same logical consumer.

### 5.6 Expose Metrics From Another Application

If the other application should appear in Prometheus and Grafana, expose a Prometheus-compatible endpoint:

```text
GET /metrics
```

Node.js example:

```javascript
const express = require('express');
const { register, collectDefaultMetrics } = require('prom-client');

const app = express();
collectDefaultMetrics({ register });

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

Then add a scrape job in `monitoring/prometheus/prometheus.yml`:

```yaml
- job_name: '<other-application-name>'
  metrics_path: '/metrics'
  static_configs:
    - targets: ['<host-or-service-name>:<port>']
      labels:
        service: '<other-application-name>'
```

Redeploy Prometheus after updating the scrape config.

### 5.7 End-To-End Onboarding Checklist

Use this checklist when a developer wants to connect another application.

1. Confirm the application runtime: laptop, external server, Docker container, or Swarm service.
2. Choose internal or external Redis and Kafka addresses.
3. Add `REDIS_HOST`, `REDIS_PORT`, `KAFKA_BROKERS`, `KAFKA_CLIENT_ID`, and `KAFKA_GROUP_ID`.
4. Confirm firewall or network access to `172.20.104.100` when using external addresses.
5. Add Redis client code only where cache is required.
6. Add Kafka producer code for events the application owns.
7. Add Kafka consumer code for events the application needs.
8. Define event payload contracts before consumers depend on them.
9. Add `/metrics` if the application needs monitoring.
10. Add a Prometheus scrape job for the new application.
11. Verify Redis with `PING`.
12. Verify Kafka by producing and consuming a test message.
13. Verify consumer lag in Kafka UI.
14. Verify metrics target state in Prometheus.

### 5.8 Quick Connectivity Tests For Other Applications

Redis from an external machine:

```bash
redis-cli -h 172.20.104.100 -p 6379 ping
```

Kafka metadata from an external machine with Kafka CLI installed:

```bash
kafka-broker-api-versions \
  --bootstrap-server 172.20.104.100:9092,172.20.104.100:9093,172.20.104.100:9094
```

Kafka topic list from the integration server:

```bash
ssh svcadm@172.20.104.100
KAFKA_CONTAINER=$(docker ps -q --filter name=services-integration_kafka-1)
docker exec -it "$KAFKA_CONTAINER" kafka-topics \
  --bootstrap-server kafka-1:29092 \
  --list
```

Kafka UI:

```text
http://172.20.104.100:8090
```

Prometheus targets:

```text
http://172.20.104.100:9090/prometheus/targets
```

### 5.9 Access And Safety Notes

- The current stack exposes Kafka and Redis without application-level authentication.
- Only trusted applications and trusted developers should be allowed to connect.
- Restrict access with firewall, VPN, security group, or reverse proxy controls.
- Use unique Kafka topic names for unrelated external applications.
- Do not publish test messages to production-like topics unless consumers can safely ignore them.
- Prefix Redis keys with the external application name to avoid collisions.
- Use local-specific consumer groups while testing to avoid consuming shared environment messages.

## 6. Current Service Usage In This Repository

| Application Service | Redis | Kafka Producer | Kafka Consumer | Metrics |
| --- | --- | --- | --- | --- |
| `user-service` | Yes, through `utils/cache.js` | Config present in Compose env | Not currently implemented in source | `/metrics` |
| `product-service` | Yes, through `utils/cache.js` | Yes, through `config/kafka.js` | Yes, `productKafkaConsumer.js` | `/metrics` |
| `cart-service` | Yes, through `utils/cache.js` and `config/redis.js` | Config present in Compose env | Yes, `cartKafkaConsumer.js` | `/metrics` |
| `order-service` | Yes, through `utils/cache.js` | Yes, `services/kafkaProducer.js` | Config helper exists | `/metrics` |

## 7. Redis Development Usage

### 7.1 Connection Pattern

The existing services use the official `redis` Node.js package. The common pattern is:

```javascript
const redis = require('redis');

const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

await client.connect();
```

### 7.2 Cache Helpers

Use the local cache utility functions instead of calling Redis directly from controller code:

- `setCache(key, value, expiryInSeconds)`
- `getCache(key)`
- `deleteCache(key)`
- `deleteCacheByPattern(pattern)`

Current examples:

- `user-service/utils/cache.js`
- `product-service/utils/cache.js`
- `cart-service/utils/cache.js`
- `order-service/utils/cache.js`

### 7.3 Key Design Guidelines

Use predictable key prefixes:

```text
user:<userId>
product:<productId>
cart:<userId>
auth:<userId>:token
order:<orderId>
```

Set TTLs for derived or frequently changing data. Do not use Redis as the only source of truth for orders, product inventory, users, or carts.

Recommended TTLs:

| Data Type | Suggested TTL |
| --- | ---: |
| Auth/session lookup | 5 to 30 minutes |
| Product detail cache | 5 to 15 minutes |
| Cart read cache | 1 to 5 minutes |
| User profile cache | 5 to 30 minutes |
| Static lookup data | 1 to 24 hours |

### 7.4 Redis Validation

From the integration server:

```bash
redis-cli -h 127.0.0.1 -p 6379 ping
redis-cli -h 127.0.0.1 -p 6379 keys '*'
```

From a container on `ecommerce-network`:

```bash
redis-cli -h redis -p 6379 ping
```

Expected response:

```text
PONG
```

## 8. Kafka Development Usage

### 8.1 Bootstrap Servers

Inside Docker or Swarm:

```text
kafka-1:29092,kafka-2:29093,kafka-3:29094
```

Outside Docker:

```text
172.20.104.100:9092,172.20.104.100:9093,172.20.104.100:9094
```

The stack uses PLAINTEXT Kafka listeners. No SASL or TLS is configured.

### 8.2 Kafka Client Pattern

Use `kafkajs`, which is already used in the Node.js services:

```javascript
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'my-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});
```

Producer:

```javascript
const producer = kafka.producer({ allowAutoTopicCreation: true });
await producer.connect();

await producer.send({
  topic: 'order-events',
  messages: [
    {
      key: orderId,
      value: JSON.stringify({
        eventType: 'order.created',
        data: orderPayload,
        timestamp: new Date().toISOString()
      }),
      headers: {
        'event-type': 'order.created',
        service: 'order-service',
        version: '1.0'
      }
    }
  ]
});
```

Consumer:

```javascript
const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'my-service-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000
});

await consumer.connect();
await consumer.subscribe({ topics: ['order-events'], fromBeginning: false });

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const event = JSON.parse(message.value.toString());
    await handleEvent(event, { topic, partition, key: message.key?.toString() });
  }
});
```

### 8.3 Event Envelope

Use one consistent event shape across services:

```json
{
  "eventType": "order.created",
  "data": {
    "orderId": "1001",
    "userId": "U001"
  },
  "timestamp": "2026-05-19T10:30:00.000Z"
}
```

Recommended Kafka message fields:

| Field | Source | Purpose |
| --- | --- | --- |
| `topic` | Producer routing | Business event stream |
| `key` | Entity ID | Keeps events for the same entity ordered in one partition |
| `value.eventType` | Producer | Logical event action |
| `value.data` | Producer | Business payload |
| `value.timestamp` | Producer | Event creation time |
| `headers.service` | Producer | Source service |
| `headers.version` | Producer | Contract version |

### 8.4 Existing Topic Map

The current `order-service/services/kafkaProducer.js` maps event types to topics:

| Event Type | Topic | Current Consumer |
| --- | --- | --- |
| `order.created` | `order-events` | Product and Cart backup handlers |
| `order.updated` | `order-events` | Future use |
| `order.cancelled` | `order-events` | Product |
| `order.status.updated` | `order-events` | Future use |
| `order.analytics` | `analytics-events` | Future use |
| `inventory.update` | `inventory-events` | Product |
| `inventory.restore` | `inventory-events` | Product |
| `inventory.reserved` | `inventory-events` | Future use |
| `cart.clear` | `cart-events` | Cart |
| `cart.checkout` | `cart-events` | Cart |
| `payment.initiated` | `payment-events` | Future use |
| `payment.completed` | `payment-events` | Future use |
| `payment.failed` | `payment-events` | Future use |
| `notification.order.created` | `notification-events` | Future use |
| `notification.order.shipped` | `notification-events` | Future use |
| `notification.order.delivered` | `notification-events` | Future use |

### 8.5 Topic Creation Rules

Kafka auto topic creation is enabled in the stack:

```text
KAFKA_AUTO_CREATE_TOPICS_ENABLE=true
KAFKA_NUM_PARTITIONS=3
KAFKA_DEFAULT_REPLICATION_FACTOR=1
```

For development this is convenient, but for important application topics prefer explicit creation:

```bash
KAFKA_CONTAINER=$(docker ps -q --filter name=services-integration_kafka-1)

docker exec -it "$KAFKA_CONTAINER" kafka-topics \
  --bootstrap-server kafka-1:29092 \
  --create \
  --if-not-exists \
  --topic order-events \
  --partitions 3 \
  --replication-factor 1
```

Current production stack default replication factor is `1`. Do not assume an auto-created topic is replicated across all brokers.

### 8.6 Consumer Group Rules

Use one stable consumer group per service responsibility:

```text
product-service-inventory-group
cart-service-group
order-service-group
```

Use a new group only when you intentionally want to replay messages from the beginning.

For real business processing, commit offsets only after the business action succeeds. If processing fails before the offset is committed, Kafka can redeliver the message to the same group.

## 9. Current End-To-End Event Flow

### 9.1 Order Created Flow

1. Client creates an order through `order-service`.
2. `order-service` validates user, cart, and product data through service calls.
3. `order-service` persists the order in MySQL.
4. `order-service` publishes domain events through Kafka.
5. `product-service` consumes inventory events and updates product stock.
6. `cart-service` consumes cart events and clears or converts the user's cart.
7. Developers inspect topics, payloads, and consumer lag in Kafka UI.
8. Developers inspect service and container health in Prometheus and Grafana.

Expected event sequence:

```text
order-service
  -> order-events: order.created
  -> inventory-events: inventory.update
  -> cart-events: cart.clear

product-service
  -> consumes inventory-events
  -> decrements stock

cart-service
  -> consumes cart-events
  -> clears cart
```

### 9.2 Order Cancelled Flow

Expected event sequence:

```text
order-service
  -> order-events: order.cancelled
  -> inventory-events: inventory.restore

product-service
  -> consumes inventory-events
  -> restores stock
```

### 9.3 Cart Checkout Flow

Expected event sequence:

```text
cart-service or order-service
  -> cart-events: cart.checkout

cart-service
  -> consumes cart-events
  -> marks cart as checkout
```

## 10. Adding A New Development Integration

Use this checklist when a developer adds a new feature that needs the integration stack.

### 10.1 For Redis

1. Add `REDIS_HOST` and `REDIS_PORT` to the service environment.
2. Use an existing cache utility or create one with the same pattern.
3. Use key prefixes that include the domain name.
4. Add a TTL unless the key is intentionally persistent.
5. Do not hide source-of-truth database failures behind stale cache.
6. Expose cache hit and miss metrics where useful.

### 10.2 For Kafka Producers

1. Add `KAFKA_BROKERS`, `KAFKA_CLIENT_ID`, and `ENABLE_KAFKA`.
2. Define the event type and topic.
3. Add the topic to a central topic map for the service.
4. Use the entity ID as the message key.
5. Use the standard event envelope.
6. Include source service and version headers.
7. Log publish success and failure.
8. Make publishing failure behavior explicit: fail request, retry, or continue with degraded behavior.

### 10.3 For Kafka Consumers

1. Add `KAFKA_BROKERS` and `KAFKA_GROUP_ID`.
2. Use a stable consumer group name.
3. Subscribe only to required topics.
4. Route by `eventType`.
5. Make handlers idempotent where possible.
6. Commit offsets only after successful processing.
7. Log unknown event types at debug or warn level.
8. Add health reporting for consumer connected/running state.

### 10.4 For Metrics

1. Install and use `prom-client`.
2. Call `collectDefaultMetrics`.
3. Expose `GET /metrics`.
4. Add request counters and latency histograms through middleware.
5. Add the service to Prometheus scrape config if Prometheus can reach it.
6. Verify the service appears as `UP` in Prometheus targets.

## 11. Local Development Modes

### 11.1 Full Local Docker Compose

Use this when you want app services and integration dependencies on your machine:

```bash
docker compose up -d redis zookeeper kafka-1 kafka-2 kafka-3 kafka-ui prometheus grafana
docker compose up -d user-service product-service cart-service order-service
```

Application services in Compose already use:

```env
REDIS_HOST=redis
KAFKA_BROKERS=kafka-1:29092,kafka-2:29093,kafka-3:29094
```

### 11.2 Local Service Against Remote Integration Stack

Use this when you run only one Node.js service locally but want to connect to the shared integration server:

```env
REDIS_HOST=172.20.104.100
REDIS_PORT=6379
KAFKA_BROKERS=172.20.104.100:9092,172.20.104.100:9093,172.20.104.100:9094
KAFKA_CLIENT_ID=order-service-local
KAFKA_GROUP_ID=order-service-local-group
```

Use a local-specific `KAFKA_GROUP_ID` if you do not want your local consumer to steal messages from the shared development consumer group.

### 11.3 Application Container Against Swarm Integration Stack

If a service container is deployed to the same Swarm network, use internal service names:

```env
REDIS_HOST=redis
KAFKA_BROKERS=kafka-1:29092,kafka-2:29093,kafka-3:29094
```

If it is deployed to a different Docker network, attach it to `ecommerce-network` or use the external host ports.

## 12. Developer Validation Steps

### 12.1 Verify Stack Is Running

SSH to the integration server:

```bash
ssh svcadm@172.20.104.100
```

Check stack services:

```bash
docker stack services services-integration
docker stack ps services-integration --no-trunc
```

### 12.2 Verify Kafka

```bash
KAFKA_CONTAINER=$(docker ps -q --filter name=services-integration_kafka-1)

docker exec -it "$KAFKA_CONTAINER" kafka-broker-api-versions \
  --bootstrap-server kafka-1:29092
```

List topics:

```bash
docker exec -it "$KAFKA_CONTAINER" kafka-topics \
  --bootstrap-server kafka-1:29092 \
  --list
```

Check consumer group lag:

```bash
docker exec -it "$KAFKA_CONTAINER" kafka-consumer-groups \
  --bootstrap-server kafka-1:29092 \
  --describe \
  --group cart-service-group
```

### 12.3 Verify Redis

```bash
docker exec -it "$(docker ps -q --filter name=services-integration_redis)" redis-cli ping
```

Expected:

```text
PONG
```

### 12.4 Verify Metrics

From a service:

```bash
curl http://localhost:<service-port>/metrics
```

From Prometheus UI:

```text
http://172.20.104.100:9090/prometheus/targets
```

A target is healthy when its state is `UP`.

### 12.5 Verify Dashboards

Open Grafana:

```text
http://172.20.104.100:3030
```

Default credentials from `.env.prod`:

```text
admin / admin
```

Check dashboards for:

- Service request volume.
- Service error rates.
- Node.js memory and event loop metrics.
- Container CPU and memory.
- Host CPU, memory, disk, and network.

## 13. Kafka UI Workflow

Open:

```text
http://172.20.104.100:8090
```

Use Kafka UI for:

1. Confirming a topic exists.
2. Checking partition count and offsets.
3. Reading sample messages.
4. Checking consumer groups.
5. Confirming consumer lag is decreasing.
6. Debugging whether a producer sent a malformed event.

For event debugging, check:

- Topic name.
- Message key.
- JSON payload shape.
- `eventType`.
- Source service header.
- Consumer group lag.

## 14. Prometheus Integration For New Services

Each Node.js service should expose:

```text
GET /metrics
```

Basic Express setup:

```javascript
const { register, collectDefaultMetrics } = require('prom-client');

collectDefaultMetrics({ register });

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

If the service is reachable by Prometheus inside Docker:

```yaml
- job_name: 'order-service'
  metrics_path: '/metrics'
  static_configs:
    - targets: ['order-service:3004']
      labels:
        service: 'order-service'
```

If the service is reachable only by host IP:

```yaml
- job_name: 'order-service'
  metrics_path: '/metrics'
  static_configs:
    - targets: ['172.20.104.100:3004']
      labels:
        service: 'order-service'
```

Update:

```text
monitoring/prometheus/prometheus.yml
```

Then redeploy Prometheus or redeploy the stack.

## 15. Deployment Commands For Integration Stack

Full stack deployment:

```bash
chmod +x deploy-integration-service.sh
./deploy-integration-service.sh
```

Deploy one infrastructure image:

```bash
./deployment/deploy-integration-service-image.sh grafana
./deployment/deploy-integration-service-image.sh prometheus
./deployment/deploy-integration-service-image.sh kafka
./deployment/deploy-integration-service-image.sh kafka-ui
```

Use full stack deployment when stack configuration changes. Use single-image deployment when only one image or related provisioning files need refresh.

## 16. Troubleshooting

### 16.1 Kafka Producer Cannot Connect

Check whether the application is using the correct bootstrap address.

Inside Docker:

```env
KAFKA_BROKERS=kafka-1:29092,kafka-2:29093,kafka-3:29094
```

Outside Docker:

```env
KAFKA_BROKERS=172.20.104.100:9092,172.20.104.100:9093,172.20.104.100:9094
```

Verify brokers:

```bash
docker service logs --tail 100 services-integration_kafka-1
docker service logs --tail 100 services-integration_kafka-2
docker service logs --tail 100 services-integration_kafka-3
```

### 16.2 Kafka UI Returns 500

Check broker stability:

```bash
docker stack ps services-integration --filter name=services-integration_kafka --no-trunc
docker service logs --tail 100 services-integration_kafka-ui
```

Check Kafka UI bootstrap server configuration:

```bash
docker service inspect services-integration_kafka-ui \
  --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' \
  | grep KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS
```

Expected:

```text
KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=kafka-1:29092,kafka-2:29093,kafka-3:29094
```

### 16.3 Consumer Does Not Receive Messages

Check:

- Producer sent to the expected topic.
- Consumer subscribed to that topic.
- Consumer group is correct.
- Consumer group has no unexpected lag.
- Message payload is valid JSON.
- `eventType` matches the handler switch case.

CLI check:

```bash
docker exec -it "$KAFKA_CONTAINER" kafka-consumer-groups \
  --bootstrap-server kafka-1:29092 \
  --describe \
  --group product-service-inventory-group
```

### 16.4 Redis Connection Fails

Check address mode:

```text
redis:6379                 for containers on ecommerce-network
172.20.104.100:6379        for external local processes
```

Check Redis logs:

```bash
docker service logs --tail 100 services-integration_redis
```

### 16.5 Prometheus Target Is Down

Check that the service exposes `/metrics`:

```bash
curl http://<service-host>:<service-port>/metrics
```

Check Prometheus targets:

```text
http://172.20.104.100:9090/prometheus/targets
```

If the target uses a Docker service name, Prometheus must be on the same Docker network.

## 17. Development Best Practices

- Keep event payloads backward compatible.
- Add new fields instead of renaming existing fields.
- Version event contracts with headers or payload metadata.
- Use message keys to preserve ordering per entity.
- Make consumers idempotent because Kafka can redeliver.
- Do not perform long blocking work inside a consumer without timeouts.
- Do not let local development consumers use the same group as a shared environment unless intentional.
- Add logs around publish, consume, success, failure, and retry.
- Use Redis only as cache unless the feature explicitly tolerates data loss.
- Keep `/metrics` unauthenticated only on trusted internal networks.

## 18. Related Documents

- `docker-stack.yml`: Stack definition.
- `.env.prod`: Production integration stack configuration.
- `docker-stack-technical-document.md`: Infrastructure and operational technical details.
- `deployment.MD`: Deployment and troubleshooting commands.
- `kafka.md`: Kafka CLI demo and failure handling examples.
- `monitoring/Monitoring.MD`: Monitoring setup notes.
