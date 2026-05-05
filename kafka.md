# Kafka CLI Demo Steps

Use this guide to demo Kafka producer and consumer flow on the `services-integration` Swarm stack.

## 1. SSH To Server

```bash
ssh svcadm@172.20.104.100
```

If your Docker commands require root:

```bash
sudo -i
```

## 2. Verify Kafka Services

```bash
docker stack ps services-integration --filter name=services-integration_kafka --no-trunc
docker service ls | grep services-integration
```

Kafka brokers should be `Running`. If any broker is restarting, check logs first:

```bash
docker service logs --tail 100 services-integration_kafka-1
docker service logs --tail 100 services-integration_kafka-2
docker service logs --tail 100 services-integration_kafka-3
docker service logs --tail 100 services-integration_zookeeper
```

## 3. Get A Kafka Container

Use Kafka 1 as the CLI shell:

```bash
KAFKA_CONTAINER=$(docker ps -q --filter name=services-integration_kafka-1)
echo "$KAFKA_CONTAINER"
```

If this prints an empty line, Kafka 1 is not currently running.

## 4. Verify Broker Connectivity

```bash
docker exec -it "$KAFKA_CONTAINER" kafka-broker-api-versions --bootstrap-server kafka-1:29092
```

You should see broker version output, not a timeout.

## 5. Create Demo Topic

For the current single-node/single-replica-safe configuration:

```bash
docker exec -it "$KAFKA_CONTAINER" kafka-topics \
  --bootstrap-server kafka-1:29092 \
  --create \
  --if-not-exists \
  --topic team-demo-orders \
  --partitions 3 \
  --replication-factor 1
```

Describe the topic:

```bash
docker exec -it "$KAFKA_CONTAINER" kafka-topics \
  --bootstrap-server kafka-1:29092 \
  --describe \
  --topic team-demo-orders
```

## 6. Terminal 1: Start Consumer

Open a first SSH terminal and run:

```bash
KAFKA_CONTAINER=$(docker ps -q --filter name=services-integration_kafka-1)

docker exec -it "$KAFKA_CONTAINER" kafka-console-consumer \
  --bootstrap-server kafka-1:29092 \
  --topic team-demo-orders \
  --group team-demo-consumer-group \
  --from-beginning \
  --property print.key=true \
  --property key.separator=" -> "
```

Keep this terminal open. It waits for messages.

## 7. Terminal 2: Start Producer

Open a second SSH terminal and run:

```bash
KAFKA_CONTAINER=$(docker ps -q --filter name=services-integration_kafka-1)

docker exec -it "$KAFKA_CONTAINER" kafka-console-producer \
  --bootstrap-server kafka-1:29092 \
  --topic team-demo-orders \
  --property parse.key=true \
  --property key.separator=":"
```

Type these messages one by one and press Enter after each:

```text
order-1001:{"orderId":"1001","customerId":"C001","amount":1499,"status":"created"}
order-1002:{"orderId":"1002","customerId":"C002","amount":2999,"status":"created"}
order-1001:{"orderId":"1001","customerId":"C001","amount":1499,"status":"paid"}
```

The first terminal should show:

```text
order-1001 -> {"orderId":"1001","customerId":"C001","amount":1499,"status":"created"}
order-1002 -> {"orderId":"1002","customerId":"C002","amount":2999,"status":"created"}
order-1001 -> {"orderId":"1001","customerId":"C001","amount":1499,"status":"paid"}
```

Stop the producer with `Ctrl+C` after sending the demo messages.

## 8. Check Consumer Group

```bash
KAFKA_CONTAINER=$(docker ps -q --filter name=services-integration_kafka-1)

docker exec -it "$KAFKA_CONTAINER" kafka-consumer-groups \
  --bootstrap-server kafka-1:29092 \
  --describe \
  --group team-demo-consumer-group
```

Useful fields:

```text
CURRENT-OFFSET
LOG-END-OFFSET
LAG
```

If the consumer read everything, `LAG` should be `0`.

## 9. Demo Consumer Replay

Stop the consumer with `Ctrl+C`.

Start a new consumer group to replay messages from the beginning:

```bash
KAFKA_CONTAINER=$(docker ps -q --filter name=services-integration_kafka-1)

docker exec -it "$KAFKA_CONTAINER" kafka-console-consumer \
  --bootstrap-server kafka-1:29092 \
  --topic team-demo-orders \
  --group team-demo-replay-group \
  --from-beginning \
  --property print.key=true \
  --property key.separator=" -> " \
  --timeout-ms 10000
```

Because this is a new group, it reads the existing topic messages from the beginning.

## 10. List Topics

```bash
docker exec -it "$KAFKA_CONTAINER" kafka-topics \
  --bootstrap-server kafka-1:29092 \
  --list
```

## 11. Optional Cleanup

Delete the demo topic:

```bash
docker exec -it "$KAFKA_CONTAINER" kafka-topics \
  --bootstrap-server kafka-1:29092 \
  --delete \
  --topic team-demo-orders
```

Delete demo consumer group offsets:

```bash
docker exec -it "$KAFKA_CONTAINER" kafka-consumer-groups \
  --bootstrap-server kafka-1:29092 \
  --delete \
  --group team-demo-consumer-group

docker exec -it "$KAFKA_CONTAINER" kafka-consumer-groups \
  --bootstrap-server kafka-1:29092 \
  --delete \
  --group team-demo-replay-group
```

## 12. Negative Scenario: Consumer Fails Before Commit

This demo shows that a Kafka message is not lost when the consumer fails before committing its offset.

Kafka does not remove a message from the topic when a consumer reads it. Kafka stores the message for the configured retention period. Consumer groups track progress by committed offsets. If the consumer fails before committing the offset, the same message can be read again by that consumer group.

### 12.1 Create A Failure Demo Topic

```bash
KAFKA_CONTAINER=$(docker ps -q --filter name=services-integration_kafka-1)

docker exec -it "$KAFKA_CONTAINER" kafka-topics \
  --bootstrap-server kafka-1:29092 \
  --create \
  --if-not-exists \
  --topic team-demo-failure \
  --partitions 1 \
  --replication-factor 1
```

### 12.2 Produce One Message

```bash
docker exec -it "$KAFKA_CONTAINER" kafka-console-producer \
  --bootstrap-server kafka-1:29092 \
  --topic team-demo-failure \
  --property parse.key=true \
  --property key.separator=":"
```

Type this message and press Enter:

```text
payment-9001:{"paymentId":"9001","orderId":"1001","amount":1499,"action":"charge-card"}
```

Stop the producer with `Ctrl+C`.

### 12.3 Simulate Consumer Failure Without Offset Commit

Run this consumer with auto commit disabled:

```bash
docker exec -it "$KAFKA_CONTAINER" kafka-console-consumer \
  --bootstrap-server kafka-1:29092 \
  --topic team-demo-failure \
  --group team-demo-failure-group \
  --from-beginning \
  --consumer-property enable.auto.commit=false \
  --property print.key=true \
  --property key.separator=" -> " \
  --max-messages 1
```

Expected output:

```text
payment-9001 -> {"paymentId":"9001","orderId":"1001","amount":1499,"action":"charge-card"}
```

Explain this as the failed processing path:

```text
Consumer received the message.
Consumer tried to charge the card.
The downstream action failed.
Consumer returns failure and does not commit the Kafka offset.
```

Because auto commit is disabled, the consumer group should not advance its committed offset.

### 12.4 Read Again With Same Consumer Group

Run the same command again:

```bash
docker exec -it "$KAFKA_CONTAINER" kafka-console-consumer \
  --bootstrap-server kafka-1:29092 \
  --topic team-demo-failure \
  --group team-demo-failure-group \
  --from-beginning \
  --consumer-property enable.auto.commit=false \
  --property print.key=true \
  --property key.separator=" -> " \
  --max-messages 1
```

You should see the same message again:

```text
payment-9001 -> {"paymentId":"9001","orderId":"1001","amount":1499,"action":"charge-card"}
```

This proves the message was not lost after the failed consumer attempt.

### 12.5 Simulate Success And Commit

Now consume with auto commit enabled:

```bash
docker exec -it "$KAFKA_CONTAINER" kafka-console-consumer \
  --bootstrap-server kafka-1:29092 \
  --topic team-demo-failure \
  --group team-demo-failure-group \
  --from-beginning \
  --consumer-property enable.auto.commit=true \
  --consumer-property auto.commit.interval.ms=1000 \
  --property print.key=true \
  --property key.separator=" -> " \
  --max-messages 1
```

Explain this as the successful processing path:

```text
Consumer received the message.
Consumer performed the business action successfully.
Consumer committed the Kafka offset.
Consumer returns success.
```

Wait a few seconds, then check the consumer group:

```bash
docker exec -it "$KAFKA_CONTAINER" kafka-consumer-groups \
  --bootstrap-server kafka-1:29092 \
  --describe \
  --group team-demo-failure-group
```

Expected result:

```text
LAG 0
```

### 12.6 Important Talking Point

For real application code, the consumer should commit the Kafka offset only after the business action succeeds.

Recommended application flow:

```text
1. Poll message from Kafka.
2. Process business action.
3. If action succeeds, commit offset and return success.
4. If action fails, do not commit offset; return failure or retry.
5. Kafka can redeliver the message to the same consumer group.
```

This is the behavior your team should rely on. Kafka preserves the message; your consumer offset commit decides whether the consumer group has finished processing it.

## Troubleshooting

If Kafka UI shows HTTP `500`, check whether brokers are stable:

```bash
docker stack ps services-integration --filter name=services-integration_kafka --no-trunc
docker service logs --tail 100 services-integration_kafka-ui
```

If broker tasks show `exit (137)`, the host likely killed the Kafka process due to memory pressure:

```bash
free -h
docker stats --no-stream
dmesg -T | grep -i -E 'killed process|oom'
```

If producer or consumer cannot connect, verify DNS and broker metadata from inside Kafka 1:

```bash
docker exec -it "$KAFKA_CONTAINER" getent hosts kafka-1 kafka-2 kafka-3 zookeeper
docker exec -it "$KAFKA_CONTAINER" kafka-broker-api-versions --bootstrap-server kafka-1:29092
```
