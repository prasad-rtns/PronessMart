# Docker Stack Technical Document

## 1. Purpose

This document describes the platform services deployed by `docker-stack.yml` for the `services-integration` Docker Swarm stack. The stack provides shared infrastructure for the application ecosystem:

- Redis cache and lightweight persistence
- Zookeeper coordination service
- Three Kafka brokers for event streaming
- Kafka UI for broker, topic, and consumer-group visibility
- Prometheus for metrics collection and alert rule evaluation
- Node Exporter for host-level metrics
- cAdvisor for container-level metrics
- Grafana for dashboards and operational visualization

The stack is deployed to the production integration server configured in `.env.prod`.

## 2. Deployment Scope

Stack name:

```text
services-integration
```

Production server:

```text
172.20.104.100
```

Deployment root on the server:

```text
/tmp/services-integration
```

Docker Swarm is used as the runtime orchestrator. Services are attached to a shared overlay network named `ecommerce-network`, which is also marked as attachable so other containers can join it when required.

## 3. Service Inventory

| Service | Image | Published Port | Internal Port | Replica Mode | Purpose |
| --- | --- | ---: | ---: | --- | --- |
| `redis` | `redis:7-alpine` | `6379` | `6379` | 1 replica | Shared Redis service with append-only persistence |
| `zookeeper` | `confluentinc/cp-zookeeper:7.5.0` | `2181` | `2181` | 1 replica | Kafka cluster coordination |
| `kafka-1` | `confluentinc/cp-kafka:7.5.0` | `9092` | `9092` external, `29092` internal | 1 replica | Kafka broker 1 |
| `kafka-2` | `confluentinc/cp-kafka:7.5.0` | `9093` | `9093` external, `29093` internal | 1 replica | Kafka broker 2 |
| `kafka-3` | `confluentinc/cp-kafka:7.5.0` | `9094` | `9094` external, `29094` internal | 1 replica | Kafka broker 3 |
| `kafka-ui` | `provectuslabs/kafka-ui:latest` | `8090` | `8080` | 1 replica | Web UI for Kafka operations |
| `prometheus` | `prom/prometheus:latest` | `9090` | `9090` | 1 replica | Metrics collection, storage, alert rules |
| `node-exporter` | `prom/node-exporter:latest` | `9100` | `9100` | Global | Host CPU, memory, disk, network metrics |
| `cadvisor` | `gcr.io/cadvisor/cadvisor:latest` | `8081` | `8080` | Global | Docker container resource metrics |
| `grafana` | `grafana/grafana:10.4.6` | `3030` | `3000` | 1 replica | Dashboards and metric visualization |

## 4. Feature Details

### 4.1 Redis

Redis is deployed as a single Swarm service with append-only file persistence enabled:

```text
redis-server --appendonly yes
```

The service stores data in the named volume `redis-data`, mounted at `/data`. This protects Redis state across container restarts as long as the Swarm volume is retained.

### 4.2 Zookeeper

Zookeeper is deployed as the Kafka coordination layer. It exposes port `2181` and stores state in two named volumes:

- `zookeeper-data` mounted at `/var/lib/zookeeper/data`
- `zookeeper-logs` mounted at `/var/lib/zookeeper/log`

The service includes a health check using the Zookeeper `ruok` command through `nc`.

### 4.3 Kafka Cluster

The stack deploys three Kafka brokers:

- `kafka-1`
- `kafka-2`
- `kafka-3`

Each broker has:

- A stable broker ID
- Internal listener for Swarm network clients
- External listener for clients outside the Swarm host
- Persistent broker storage through a dedicated named volume
- Automatic topic creation enabled
- Three default partitions

Internal bootstrap servers for services on the overlay network:

```text
kafka-1:29092,kafka-2:29093,kafka-3:29094
```

External bootstrap servers:

```text
172.20.104.100:9092,172.20.104.100:9093,172.20.104.100:9094
```

Kafka topics are configured with:

```text
KAFKA_AUTO_CREATE_TOPICS_ENABLE=true
KAFKA_NUM_PARTITIONS=3
KAFKA_DEFAULT_REPLICATION_FACTOR=1
KAFKA_MIN_INSYNC_REPLICAS=1
```

Important operational note: although three brokers are deployed, the current default replication factor is `1`. This means newly auto-created topics are not automatically replicated across brokers unless topic creation explicitly sets a higher replication factor.

`kafka-3` has explicit memory limits:

```text
limit: 2G
reservation: 1G
```

Kafka heap options are provided through `.env.prod`:

```text
KAFKA_HEAP_OPTS="-Xms512M -Xmx1G"
```

### 4.4 Kafka UI

Kafka UI is deployed for technical users to inspect:

- Kafka brokers
- Topics
- Partitions
- Consumer groups
- Messages where access is allowed by the UI

The UI connects to Kafka using internal Swarm DNS:

```text
kafka-1:29092,kafka-2:29093,kafka-3:29094
```

It is configured with the base path:

```text
/kafka
```

Direct access:

```text
http://172.20.104.100:8090
```

Reverse-proxy access, when Nginx is configured:

```text
http://172.20.104.100/kafka/
```

### 4.5 Prometheus

Prometheus is deployed for metrics collection, local time-series storage, and alert rule evaluation.

Retention:

```text
30d
```

Prometheus runs with a sub-path configuration:

```text
--web.external-url=http://172.20.104.100/prometheus/
--web.route-prefix=/prometheus
```

Direct access:

```text
http://172.20.104.100:9090/prometheus/
```

Reverse-proxy access:

```text
http://172.20.104.100/prometheus/
```

Prometheus mounts:

- `monitoring/prometheus/prometheus.yml`
- `monitoring/prometheus/alerts-prod.yml`
- `prometheus-data` at `/prometheus`

Current scrape jobs:

| Job | Target | Purpose |
| --- | --- | --- |
| `prometheus` | `prometheus:9090` | Prometheus self-monitoring |
| `node-exporter` | `node-exporter:9100` | Host metrics |
| `cadvisor` | `cadvisor:8080` | Container metrics |
| `grafana` | `grafana:3000` | Grafana metrics |

The `master-service` scrape configuration exists in `monitoring/prometheus/prometheus.yml` but is currently commented out.

### 4.6 Node Exporter

Node Exporter runs in global mode, so one instance is deployed per Swarm node. It exposes Linux host metrics to Prometheus, including:

- CPU usage
- Memory usage
- Swap usage
- Disk usage
- Filesystem inode usage
- Network interface counters
- Host boot time

Host paths are mounted read-only:

- `/proc`
- `/sys`
- `/`

Filesystem mount points such as `/sys`, `/proc`, `/dev`, `/host`, `/etc`, and `/run` are excluded from filesystem collection noise.

### 4.7 cAdvisor

cAdvisor also runs in global mode. It collects container-level resource metrics, including:

- Container CPU usage
- Container memory working set
- Container network throughput
- Container last-seen timestamps
- Docker service labels used by Prometheus alerts

It mounts Docker and host paths read-only, including:

- `/var/run/docker.sock`
- `/var/lib/docker`
- `/sys`
- `/dev/disk`

### 4.8 Grafana

Grafana provides dashboards for platform and service visibility. It is pinned to:

```text
grafana/grafana:10.4.6
```

The stack intentionally avoids `grafana/grafana:latest` because newer image behavior can break provisioning startup.

Grafana is configured to serve from:

```text
/grafana
```

Direct access:

```text
http://172.20.104.100:3030
```

Reverse-proxy access:

```text
http://172.20.104.100/grafana/
```

Default admin credentials are currently loaded from `.env.prod`:

```text
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
```

Provisioned datasource:

```text
Name: Prometheus
UID: prometheus
URL: http://prometheus:9090/prometheus
```

Provisioned dashboards:

| Dashboard | Purpose |
| --- | --- |
| `Prod Server Resources - 172.20.104.100` | Host and container resource monitoring |
| `E-commerce Services Overview` | Application request, latency, error, and CPU panels where metrics are available |
| `Node.js Performance Metrics` | Node.js memory, event loop, active resources, and GC metrics where metrics are available |

## 5. Networking

All services are connected to the overlay network:

```text
ecommerce-network
```

Kafka services define explicit network aliases:

```text
zookeeper
kafka-1
kafka-2
kafka-3
```

Use these internal names for service-to-service communication inside the Swarm network. For Kafka clients running inside Docker, prefer:

```text
kafka-1:29092,kafka-2:29093,kafka-3:29094
```

Avoid using generated Swarm service names with underscores as Kafka bootstrap hostnames because some Java Kafka clients reject those names during DNS validation.

## 6. Persistence

The stack uses Docker named volumes for service state.

| Volume | Used By | Container Path |
| --- | --- | --- |
| `redis-data` | Redis | `/data` |
| `zookeeper-data` | Zookeeper | `/var/lib/zookeeper/data` |
| `zookeeper-logs` | Zookeeper | `/var/lib/zookeeper/log` |
| `kafka-1-data` | Kafka broker 1 | `/var/lib/kafka/data` |
| `kafka-2-data` | Kafka broker 2 | `/var/lib/kafka/data` |
| `kafka-3-data` | Kafka broker 3 | `/var/lib/kafka/data` |
| `prometheus-data` | Prometheus | `/prometheus` |
| `grafana-data` | Grafana | `/var/lib/grafana` |

Removing these volumes deletes persisted broker data, Redis data, Prometheus history, and Grafana state.

## 7. Alerting Coverage

Prometheus loads alert rules from:

```text
monitoring/prometheus/alerts-prod.yml
```

Current alert groups:

| Group | Coverage |
| --- | --- |
| `services_server_health` | Target availability, CPU, memory, swap, disk, inode, filesystem, I/O wait, network errors, reboot detection |
| `services_container_health` | Container CPU, memory, and network throughput |
| `services_platform_health` | Prometheus config health, rule evaluation failures, Swarm service presence, stale cAdvisor metrics, Grafana availability |

Alert severities:

- `critical` for service-down, missing core services, filesystem read-only, and severe resource thresholds
- `warning` for elevated resource usage and non-critical service availability

Important note: the stack currently deploys Prometheus alert rules, but `docker-stack.yml` does not deploy Alertmanager. Alerts can be evaluated in Prometheus, but external notification routing requires Alertmanager to be deployed separately or added to this Swarm stack.

## 8. Health Checks and Restart Policy

Most services use Swarm restart policy:

```text
condition: any
```

Configured health checks:

| Service | Health Check |
| --- | --- |
| `zookeeper` | `echo ruok | nc localhost 2181` |
| `kafka-1` | TCP check on `localhost:29092` |
| `kafka-2` | TCP check on `localhost:29093` |
| `kafka-3` | TCP check on `localhost:29094` |
| `prometheus` | `http://localhost:9090/prometheus/-/healthy` |
| `grafana` | `http://localhost:3000/api/health` |

Kafka health checks have a long start period to allow brokers to initialize before Swarm evaluates them as unhealthy.

## 9. Operational URLs

| Feature | URL |
| --- | --- |
| Kafka UI direct | `http://172.20.104.100:8090` |
| Kafka UI via Nginx | `http://172.20.104.100/kafka/` |
| Prometheus direct | `http://172.20.104.100:9090/prometheus/` |
| Prometheus via Nginx | `http://172.20.104.100/prometheus/` |
| Grafana direct | `http://172.20.104.100:3030` |
| Grafana via Nginx | `http://172.20.104.100/grafana/` |
| Node Exporter metrics | `http://172.20.104.100:9100/metrics` |
| cAdvisor UI/metrics | `http://172.20.104.100:8081` |

## 10. Verification Commands

Check deployed services:

```bash
docker stack services services-integration
docker stack ps services-integration --no-trunc
```

Check logs:

```bash
docker service logs --tail 100 services-integration_kafka-ui
docker service logs --tail 100 services-integration_prometheus
docker service logs --tail 100 services-integration_grafana
```

Check Prometheus:

```bash
curl -i http://127.0.0.1:9090/prometheus/-/healthy
curl -s http://127.0.0.1:9090/prometheus/api/v1/targets
```

Check Grafana:

```bash
curl -i http://127.0.0.1:3030/api/health
```

Check Kafka metadata:

```bash
KAFKA1_CONTAINER=$(docker ps -q --filter name=services-integration_kafka-1)
docker exec -it "$KAFKA1_CONTAINER" kafka-broker-api-versions --bootstrap-server kafka-1:29092
```

List Kafka topics:

```bash
KAFKA1_CONTAINER=$(docker ps -q --filter name=services-integration_kafka-1)
docker exec -it "$KAFKA1_CONTAINER" kafka-topics --bootstrap-server kafka-1:29092 --list
```

## 11. Security and Access Considerations

- Kafka listeners are configured with `PLAINTEXT`; there is no TLS or SASL authentication in this stack.
- Redis is published on the host port without an application-level password in `docker-stack.yml`.
- Grafana admin credentials are stored in `.env.prod`.
- cAdvisor mounts Docker host paths and Docker socket read-only. Access to cAdvisor should be limited to trusted users and networks.
- Prometheus and Grafana are exposed through published ports and may also be routed through Nginx sub-paths.

For production hardening, restrict access to published ports at the firewall or reverse proxy layer, rotate Grafana credentials, and evaluate Kafka/Redis authentication requirements.

## 12. Known Constraints

- The stack is infrastructure-only. It does not deploy the application microservices.
- Kafka brokers are three separate services, but default topic replication is `1`.
- Alertmanager is not part of `docker-stack.yml`; Prometheus evaluates alerts but does not route notifications by itself.
- `master-service` scraping is currently commented out in Prometheus.
- Grafana runs as `user: "0"` to avoid first-start permissions issues on the named volume.
- Published ports are configured in Docker Swarm ingress mode.

