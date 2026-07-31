# PronesSmart Integration Stack Deployment Steps

Use these steps to deploy Redis, Zookeeper, Kafka 1-3, Kafka UI, Prometheus, and Grafana to `svcadm@172.20.104.100` with Docker Swarm.

The one-click script is the preferred path:

```bash
./deploy-integration-service.sh
```

## 1. Files Used

The deployment uses these local files:

```text
docker-stack.yml
.env.prod
monitoring/prometheus/prometheus.yml
monitoring/prometheus/alerts-prod.yml
monitoring/grafana/provisioning/
monitoring/grafana/dashboards/
```

The one-click script also exports these public Docker images to local tar files and uploads them to the server before deploying:

```text
redis:7-alpine
confluentinc/cp-zookeeper:7.5.0
confluentinc/cp-kafka:7.5.0
provectuslabs/kafka-ui:latest
prom/prometheus:latest
grafana/grafana:10.4.6
prom/node-exporter:latest
gcr.io/cadvisor/cadvisor:latest
```

Production pins Grafana through `.env.prod` as `grafana/grafana:10.4.6`. Do not use `grafana/grafana:latest` for this stack; the latest image has changed provisioning startup behavior and can fail with `Datasource provisioning error: data source not found`.

The script copies them to:

```text
/tmp/services-integration
```

## 2. Verify Server Prerequisites

SSH to the server:

```bash
ssh svcadm@172.20.104.100
```

Verify Docker is installed and Swarm is active:

```bash
docker --version
docker info --format '{{.Swarm.LocalNodeState}}'
```

If Swarm is not active, initialize it once:

```bash
docker swarm init --advertise-addr 172.20.104.100
```

Verify the external master service metrics endpoint is reachable from the production server:

```bash
curl -i --max-time 10 http://172.20.104.102:443/metrics
```

Expected result is HTTP `200` with Prometheus metric text. If this times out from `172.20.104.100`, Prometheus will show `master-service` as down.

## 3. Review Production Configuration

Before deployment, update `.env.prod` if required. The deploy script reads `SERVER_HOST` from this file and uses it for SSH/scp, Kafka advertised listeners, Prometheus labels, alert labels, and the production Grafana dashboard title.

```text
SERVER_HOST=172.20.104.100
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
```

Default published ports:

```text
Redis:      6379
Zookeeper: 2181
Kafka 1:   9092
Kafka 2:   9093
Kafka 3:   9094
Kafka UI:  8090
Prometheus: 9090
Grafana:   3030
Node Exporter: 9100
cAdvisor:  8081
```

Kafka internal broker endpoints for services deployed on the same overlay network:

```text
kafka-1:29092,kafka-2:29093,kafka-3:29094
```

These are Docker overlay network aliases. Avoid using stack-prefixed names containing `_` for Kafka client bootstrap URLs because Java Kafka clients can fail DNS validation on those names.

Kafka external broker endpoints from outside the Swarm:

```text
172.20.104.100:9092,172.20.104.100:9093,172.20.104.100:9094
```

## 4. One-Click Deployment

Run from Git Bash at the project root:

```bash
cd /c/Users/Prasad.N/WorkSpace/mach/pronessmart
chmod +x deploy-integration-service.sh
./deploy-integration-service.sh
```

The script will:

1. Validate required local stack and monitoring files.
2. Pull public images locally and save them under `/d/docker-exports/services-integration`.
3. Create `/tmp/services-integration` on `172.20.104.100`.
4. Copy `docker-stack.yml`, `.env.prod`, image tar files, Prometheus config, `alerts-prod.yml`, and Grafana provisioning files.
5. Replace `__SERVER_HOST__` placeholders in the copied monitoring files with `.env.prod` `SERVER_HOST`.
6. Load the uploaded Docker image tar files on the server.
7. Deploy the Swarm stack `services-integration` with `--resolve-image never`.
8. Print service status and basic endpoint checks.

If `svcadm` is not in the Docker group, the script falls back to `sudo -E docker` on the server.

## 5. Manual Deployment

Create the remote folder:

```bash
ssh svcadm@172.20.104.100 "mkdir -p /tmp/services-integration/monitoring/prometheus /tmp/services-integration/monitoring/grafana/provisioning/datasources /tmp/services-integration/monitoring/grafana/provisioning/dashboards /tmp/services-integration/monitoring/grafana/dashboards"
```

Copy deployment files:

```bash
scp docker-stack.yml .env.prod svcadm@172.20.104.100:/tmp/services-integration/
scp /d/docker-exports/services-integration/*.tar svcadm@172.20.104.100:/tmp/services-integration/images/
scp monitoring/prometheus/prometheus.yml svcadm@172.20.104.100:/tmp/services-integration/monitoring/prometheus/
scp monitoring/prometheus/alerts-prod.yml svcadm@172.20.104.100:/tmp/services-integration/monitoring/prometheus/
scp monitoring/grafana/provisioning/datasources/prometheus.yml svcadm@172.20.104.100:/tmp/services-integration/monitoring/grafana/provisioning/datasources/
scp monitoring/grafana/provisioning/dashboards/dashboard.yml svcadm@172.20.104.100:/tmp/services-integration/monitoring/grafana/provisioning/dashboards/
scp -r monitoring/grafana/dashboards/. svcadm@172.20.104.100:/tmp/services-integration/monitoring/grafana/dashboards/
```

Deploy on the server:

```bash
ssh svcadm@172.20.104.100
cd /tmp/services-integration
set -a
. ./.env.prod
set +a
for file in monitoring/prometheus/prometheus.yml monitoring/prometheus/alerts-prod.yml monitoring/grafana/dashboards/server-resources-prod.json; do
  sed -i "s/__SERVER_HOST__/${SERVER_HOST}/g" "$file"
done
for tar_file in images/*.tar; do
  docker load -i "$tar_file"
done
docker stack deploy --resolve-image never --with-registry-auth --compose-file docker-stack.yml services-integration
```

If `docker stack ps services-integration` shows `No such image`, the server does not have the required images locally and cannot pull them from the registry. Use the one-click script again, or manually upload/load the image tar files before running `docker stack deploy`.

For the current rejected stack, clean it up first:

```bash
docker stack rm services-integration
sleep 20
docker service ls | grep services-integration
```

Then rerun the one-click script from your local machine so it uploads and loads the image tar files before deploying.

## 6. Verify Deployment

Check services:

```bash
docker stack services services-integration
docker stack ps services-integration --no-trunc
```

Check service logs:

```bash
docker service logs -f services-integration_zookeeper
docker service logs -f services-integration_kafka-1
docker service logs -f services-integration_kafka-2
docker service logs -f services-integration_kafka-3
docker service logs -f services-integration_kafka-ui
docker service logs -f services-integration_prometheus
docker service logs -f services-integration_grafana
```

If Grafana repeatedly fails with `task: non-zero exit (1)`, inspect its startup error first:

```bash
docker service logs --tail 200 services-integration_grafana
docker stack ps services-integration --filter name=services-integration_grafana --no-trunc
```

The production stack runs Grafana with `user: "0"` so the named volume at `/var/lib/grafana` is writable on first startup. If the logs still show provisioning errors, check the uploaded files under `/tmp/services-integration/monitoring/grafana/provisioning`.

For `Datasource provisioning error: data source not found`, remove stale copied provisioning files and redeploy from the updated one-click script:

```bash
rm -rf /tmp/services-integration/monitoring/grafana/provisioning /tmp/services-integration/monitoring/grafana/dashboards
```

Then run from your local Git Bash:

```bash
./deploy-integration-service.sh
```

After redeploy, the server should have only these Grafana provisioning files:

```bash
find /tmp/services-integration/monitoring/grafana/provisioning -maxdepth 4 -type f -print
cat /tmp/services-integration/monitoring/grafana/provisioning/datasources/prometheus.yml
```

The datasource file should define `Prometheus` with `uid: prometheus`, `orgId: 1`, and `url: http://prometheus:9090`.

If Grafana still fails with the same datasource provisioning error after the fresh file is uploaded, remove the old Grafana database volume and redeploy. This deletes only Grafana's stored UI state; provisioned dashboards and datasource are recreated from the files:

```bash
docker service scale services-integration_grafana=0
docker volume rm services-integration_grafana-data
```

Then run from your local Git Bash:

```bash
./deploy-integration-service.sh
```

Test local endpoints on the server:

```bash
curl -I http://127.0.0.1:8081
curl http://127.0.0.1:9090/prometheus/-/healthy
curl http://127.0.0.1:3030/api/health
```

Browser URLs:

```text
Kafka UI:   http://172.20.104.100:8090
Prometheus: http://172.20.104.100:9090
Grafana:    http://172.20.104.100:3030
```

Grafana will provision this production resource dashboard automatically:

```text
Prod Server Resources - 172.20.104.100
```

It uses `node-exporter` and `cadvisor` metrics for host CPU, memory, disk, network, container CPU, and container memory graphs.

## 7. Kafka Verification

Run a broker metadata check from Kafka 1:

```bash
KAFKA1_CONTAINER=$(docker ps -q --filter name=services-integration_kafka-1)
echo "$KAFKA1_CONTAINER"
docker exec -it "$KAFKA1_CONTAINER" kafka-broker-api-versions --bootstrap-server kafka-1:29092
```

Create a test topic:

```bash
KAFKA1_CONTAINER=$(docker ps -q --filter name=services-integration_kafka-1)
docker exec -it "$KAFKA1_CONTAINER" kafka-topics --bootstrap-server kafka-1:29092 --create --if-not-exists --topic services-test --partitions 3 --replication-factor 2
```

List topics:

```bash
KAFKA1_CONTAINER=$(docker ps -q --filter name=services-integration_kafka-1)
docker exec -it "$KAFKA1_CONTAINER" kafka-topics --bootstrap-server kafka-1:29092 --list
```

## 8. Cleanup Old Deployment

Remove the stack:

```bash
docker stack rm services-integration
```

Wait until services are removed:

```bash
docker service ls | grep services-integration
```

Remove stack volumes only if you want to delete persisted Kafka, Redis, Prometheus, and Grafana data:

```bash
docker volume rm services-integration_redis-data services-integration_zookeeper-data services-integration_zookeeper-logs services-integration_kafka-1-data services-integration_kafka-2-data services-integration_kafka-3-data services-integration_prometheus-data services-integration_grafana-data
```

## 9. Useful Commands

Force restart one service:

```bash
docker service update --force services-integration_kafka-1
```

Force restart all services:

```bash
for service in $(docker stack services services-integration --format '{{.Name}}'); do docker service update --force "$service"; done
```

Check published ports:

```bash
docker service inspect services-integration_kafka-ui --format '{{json .Endpoint.Ports}}'
docker service inspect services-integration_prometheus --format '{{json .Endpoint.Ports}}'
docker service inspect services-integration_grafana --format '{{json .Endpoint.Ports}}'
```


## Update Nginx.config file 
```
    location = /kafka {
       return 301 /kafka/;
    }

    # kafka UI Frontend
    location /kafka/ {
       proxy_pass http://127.0.0.1:8090;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_set_header X-Forwarded-Prefix /kafka;
    }

    location = /prometheus {
       return 301 /prometheus/;
    }

    # Prometheus Frontend
    location /prometheus/ {
       proxy_pass http://127.0.0.1:9090;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /grafana {
       return 301 /grafana/;
    }

    # Grafana Frontend
    location /grafana/ {
       proxy_pass http://127.0.0.1:3030;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
    }
```

Use `3030` here, not `3000`. In this Swarm stack, host port `3030` is published to Grafana's internal container port `3000`. Port `3000` is already used by another production service and should not be used by Nginx for Grafana.
# Nginx Update

```
$ sudo nginx -t
Reload (Safe):
$ sudo systemctl reload nginx
Restart (Hard):
$ sudo systemctl restart nginx
Check the status:
$ sudo systemctl status nginx
```

If `http://172.20.104.100/grafana/` returns `404 Not Found` from `nginx/1.24.0`, Nginx is not using the location block above. Verify the active loaded configuration, not only the file you edited:

```bash
sudo nginx -T | grep -n -E 'location (= /grafana|/grafana/|= /prometheus|/prometheus/|= /kafka|/kafka/)' -A8 -B2
sudo nginx -t
sudo systemctl reload nginx
curl -i http://127.0.0.1:3030/api/health
curl -i http://172.20.104.100/grafana/
```

The local Grafana health check must return JSON from Grafana. The public `/grafana/` URL must not return an Nginx-generated 404.

## Verify Prometheus Targets

After redeploy, Prometheus must show `node-exporter`, `cadvisor`, `grafana`, and `master-service` targets. From the production server:

```bash
docker service ps services-integration_prometheus --no-trunc
docker service ps services-integration_node-exporter --no-trunc
docker service ps services-integration_cadvisor --no-trunc
docker service ps services-integration_grafana --no-trunc

curl -i http://127.0.0.1:9090/prometheus/-/healthy
curl -i http://127.0.0.1:9090/prometheus/api/v1/targets

curl -s http://127.0.0.1:9090/prometheus/api/v1/targets | grep -E '"job":"(node-exporter|cadvisor|grafana|master-service)"'
curl -s 'http://127.0.0.1:9090/prometheus/api/v1/query?query=up' | grep -E 'node-exporter|cadvisor|grafana|master-service'
```

If Grafana dashboards show `No DATA`, check that Prometheus has data first:

```bash
curl -s 'http://127.0.0.1:9090/prometheus/api/v1/query?query=node_memory_MemAvailable_bytes' | grep success
curl -s 'http://127.0.0.1:9090/prometheus/api/v1/query?query=container_memory_working_set_bytes' | grep success
```

If these return empty results, the issue is Prometheus scraping/exporter availability, not Grafana.

If the `grep` commands return nothing, do not assume the target is missing until you inspect the raw HTTP response with `curl -i`. Empty output usually means Prometheus is down, the route prefix is wrong, or the endpoint returned an error page instead of JSON.

## Verify Kafka UI Backend

If Kafka UI loads but `/kafka/api/clusters/services/brokers` returns HTTP `500`, check the Kafka UI and broker logs:

```bash
docker service logs --tail 100 services-integration_kafka-ui
docker service logs --tail 100 services-integration_kafka-1
docker service logs --tail 100 services-integration_kafka-2
docker service logs --tail 100 services-integration_kafka-3
```

Confirm Kafka UI is running with the expected bootstrap servers:

```bash
docker service inspect services-integration_kafka-ui --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep -E 'KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS|KAFKA_CLUSTERS_0_ZOOKEEPER'

KAFKA_UI_CONTAINER=$(docker ps -q --filter name=services-integration_kafka-ui)
if [ -z "$KAFKA_UI_CONTAINER" ]; then
  echo "Kafka UI container is not running"
  docker service ps services-integration_kafka-ui --no-trunc
  docker service logs --tail 100 services-integration_kafka-ui
  exit 1
fi
docker exec -it "$KAFKA_UI_CONTAINER" printenv | grep KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS
docker exec -it "$KAFKA_UI_CONTAINER" getent hosts kafka-1 kafka-2 kafka-3 zookeeper
```

Expected bootstrap servers:

```text
kafka-1:29092,kafka-2:29093,kafka-3:29094
```

If the environment still shows `services-integration_kafka-1:29092` or any other old value, the Kafka UI service is still running the old stack configuration. Redeploy the stack from the updated `docker-stack.yml`.

Then verify Kafka metadata from inside the broker container:

```bash
docker stack ps services-integration --filter name=services-integration_kafka-1 --no-trunc
KAFKA1_CONTAINER=$(docker ps -q --filter name=services-integration_kafka-1)
echo "$KAFKA1_CONTAINER"
docker exec -it "$KAFKA1_CONTAINER" kafka-broker-api-versions --bootstrap-server kafka-1:29092
docker exec -it "$KAFKA1_CONTAINER" kafka-topics --bootstrap-server kafka-1:29092 --list
```

If `echo "$KAFKA1_CONTAINER"` prints an empty line, the broker container is not running. Check `docker stack ps services-integration --filter name=services-integration_kafka-1 --no-trunc` and `docker service logs --tail 100 services-integration_kafka-1` before testing Kafka UI again.

If Kafka tasks fail with `exit (137)` or `unhealthy container`, check host memory and broker logs:

```bash
free -h
docker stats --no-stream
docker service logs --tail 200 services-integration_kafka-1
docker service logs --tail 200 services-integration_zookeeper
```

The production stack sets `KAFKA_HEAP_OPTS=-Xms128M -Xmx256M` and gives Kafka 5 minutes before health checks can fail the task. If the server is still memory constrained, reduce to one Kafka broker or increase server RAM.

## Remove Only service-integration related containers
`docker ps -a | grep service-integration | awk '{print $1}' | xargs docker rm -f`