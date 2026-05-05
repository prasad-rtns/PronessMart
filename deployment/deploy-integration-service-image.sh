#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

REMOTE_USER="svcadm"
REMOTE_DIR="/tmp/services-integration"
REMOTE_IMAGE_DIR="$REMOTE_DIR/images-single"
EXPORT_DIR="/d/docker-exports/services-integration-single"

STACK_FILE="docker-stack.yml"
ENV_FILE=".env.prod"

usage() {
  cat <<'USAGE'
Usage:
  ./deployment/deploy-integration-service-image.sh <service>

Services:
  redis
  zookeeper
  kafka       Updates kafka-1, kafka-2, and kafka-3
  kafka-1
  kafka-2
  kafka-3
  kafka-ui
  prometheus
  grafana
  node-exporter
  cadvisor

Examples:
  ./deployment/deploy-integration-service-image.sh grafana
  ./deployment/deploy-integration-service-image.sh kafka-1
  ./deployment/deploy-integration-service-image.sh kafka
USAGE
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  usage
  exit 1
fi

cd "$PROJECT_DIR"

if [ ! -f "$STACK_FILE" ]; then
  echo "Missing required file: $PROJECT_DIR/$STACK_FILE"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing required file: $PROJECT_DIR/$ENV_FILE"
  exit 1
fi

set -a
. "$ENV_FILE"
set +a

REMOTE_HOST="${SERVER_HOST:-}"
STACK_NAME="${STACK_NAME:-services-integration}"

if [ -z "$REMOTE_HOST" ]; then
  echo "SERVER_HOST is missing in $PROJECT_DIR/$ENV_FILE"
  exit 1
fi

if [ "${GRAFANA_IMAGE:-}" = "grafana/grafana:latest" ]; then
  echo "GRAFANA_IMAGE must not use latest in $ENV_FILE. Use a pinned version such as grafana/grafana:10.4.6."
  exit 1
fi

TARGET_SERVICES=()
TARGET_IMAGE=""

case "$TARGET" in
  redis)
    TARGET_SERVICES=("redis")
    TARGET_IMAGE="$REDIS_IMAGE"
    ;;
  zookeeper)
    TARGET_SERVICES=("zookeeper")
    TARGET_IMAGE="$ZOOKEEPER_IMAGE"
    ;;
  kafka)
    TARGET_SERVICES=("kafka-1" "kafka-2" "kafka-3")
    TARGET_IMAGE="$KAFKA_IMAGE"
    ;;
  kafka-1|kafka-2|kafka-3)
    TARGET_SERVICES=("$TARGET")
    TARGET_IMAGE="$KAFKA_IMAGE"
    ;;
  kafka-ui)
    TARGET_SERVICES=("kafka-ui")
    TARGET_IMAGE="$KAFKA_UI_IMAGE"
    ;;
  prometheus)
    TARGET_SERVICES=("prometheus")
    TARGET_IMAGE="$PROMETHEUS_IMAGE"
    ;;
  grafana)
    TARGET_SERVICES=("grafana")
    TARGET_IMAGE="$GRAFANA_IMAGE"
    ;;
  node-exporter)
    TARGET_SERVICES=("node-exporter")
    TARGET_IMAGE="$NODE_EXPORTER_IMAGE"
    ;;
  cadvisor)
    TARGET_SERVICES=("cadvisor")
    TARGET_IMAGE="$CADVISOR_IMAGE"
    ;;
  *)
    echo "Unsupported service: $TARGET"
    usage
    exit 1
    ;;
esac

if [ -z "$TARGET_IMAGE" ]; then
  echo "No image configured for target: $TARGET"
  exit 1
fi

echo "Target: $TARGET"
echo "Image:  $TARGET_IMAGE"
echo "Host:   $REMOTE_HOST"
echo "Stack:  $STACK_NAME"

mkdir -p "$EXPORT_DIR"

image_tar_name="$(echo "$TARGET_IMAGE" | tr '/:' '__').tar"
image_tar_path="$EXPORT_DIR/$image_tar_name"

echo "Pulling $TARGET_IMAGE locally..."
docker pull "$TARGET_IMAGE"

echo "Saving $TARGET_IMAGE to $image_tar_path..."
docker save -o "$image_tar_path" "$TARGET_IMAGE"

echo "Preparing remote deployment folder..."
ssh "$REMOTE_USER@$REMOTE_HOST" "rm -rf '$REMOTE_IMAGE_DIR' && mkdir -p '$REMOTE_IMAGE_DIR' '$REMOTE_DIR/monitoring/prometheus' '$REMOTE_DIR/monitoring/grafana/provisioning/datasources' '$REMOTE_DIR/monitoring/grafana/provisioning/dashboards' '$REMOTE_DIR/monitoring/grafana/dashboards'"

echo "Copying stack, env, and image..."
scp "$STACK_FILE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"
scp "$ENV_FILE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"
scp "$image_tar_path" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_IMAGE_DIR/"

if [ "$TARGET" = "prometheus" ]; then
  scp "monitoring/prometheus/prometheus.yml" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/monitoring/prometheus/"
  scp "monitoring/prometheus/alerts-prod.yml" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/monitoring/prometheus/"
  scp "monitoring/grafana/provisioning/datasources/prometheus.yml" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/monitoring/grafana/provisioning/datasources/"
fi

if [ "$TARGET" = "grafana" ]; then
  scp "monitoring/grafana/provisioning/datasources/prometheus.yml" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/monitoring/grafana/provisioning/datasources/"
  scp "monitoring/grafana/provisioning/dashboards/dashboard.yml" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/monitoring/grafana/provisioning/dashboards/"
  scp -r "monitoring/grafana/dashboards/." "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/monitoring/grafana/dashboards/"
fi

services_csv="$(IFS=,; echo "${TARGET_SERVICES[*]}")"

echo "Deploying selected service(s) on $REMOTE_HOST..."
ssh "$REMOTE_USER@$REMOTE_HOST" "REMOTE_DIR='$REMOTE_DIR' REMOTE_IMAGE_DIR='$REMOTE_IMAGE_DIR' STACK_NAME='$STACK_NAME' TARGET='$TARGET' TARGET_IMAGE='$TARGET_IMAGE' TARGET_SERVICES='$services_csv' bash -s" <<'EOF'
set -euo pipefail

cd "$REMOTE_DIR"

DOCKER="docker"
if ! docker info >/dev/null 2>&1; then
  DOCKER="sudo -E docker"
fi

if ! $DOCKER info --format '{{.Swarm.LocalNodeState}}' | grep -qi active; then
  echo "Docker Swarm is not active. Initialize it on this server first:"
  echo "  docker swarm init --advertise-addr ${SERVER_HOST:-<server-ip>}"
  exit 1
fi

set -a
. ./.env.prod
set +a

if [ "${GRAFANA_IMAGE:-}" = "grafana/grafana:latest" ]; then
  echo "Refusing to deploy Grafana with latest tag. Check $REMOTE_DIR/.env.prod."
  exit 1
fi

echo "Rendering monitoring configuration for ${SERVER_HOST}..."
for file in \
  monitoring/prometheus/prometheus.yml \
  monitoring/prometheus/alerts-prod.yml \
  monitoring/grafana/dashboards/server-resources-prod.json; do
  if [ -f "$file" ]; then
    sed -i "s/__SERVER_HOST__/${SERVER_HOST}/g" "$file"
  fi
done

echo "Loading uploaded image tar files..."
for tar_file in "$REMOTE_IMAGE_DIR"/*.tar; do
  [ -f "$tar_file" ] || continue
  $DOCKER load -i "$tar_file"
done

echo "Verifying rendered stack image values..."
$DOCKER stack config --compose-file docker-stack.yml > rendered-stack.yml
grep -E '^[[:space:]]+image:' rendered-stack.yml || true

if grep -q 'grafana/grafana:latest' rendered-stack.yml; then
  echo "Rendered stack contains grafana/grafana:latest; aborting."
  exit 1
fi

IFS=',' read -r -a services <<< "$TARGET_SERVICES"

missing_service=0
for service in "${services[@]}"; do
  full_service="${STACK_NAME}_${service}"
  if ! $DOCKER service inspect "$full_service" >/dev/null 2>&1; then
    echo "Service $full_service does not exist yet."
    missing_service=1
  fi
done

if [ "$missing_service" -eq 1 ]; then
  echo "At least one target service is missing. Deploying full stack once to create missing services."
  $DOCKER stack deploy --resolve-image never --with-registry-auth --compose-file docker-stack.yml "$STACK_NAME"
elif [ "$TARGET" = "kafka" ]; then
  echo "Kafka topology/config changed. Applying stack config so broker healthchecks and replication settings are refreshed."
  $DOCKER stack deploy --resolve-image never --with-registry-auth --compose-file docker-stack.yml "$STACK_NAME"
elif [[ "$TARGET" == kafka-* ]]; then
  echo "Kafka service config may include listener, replication, or healthcheck changes. Applying stack config."
  $DOCKER stack deploy --resolve-image never --with-registry-auth --compose-file docker-stack.yml "$STACK_NAME"
elif [ "$TARGET" = "kafka-ui" ]; then
  echo "Kafka UI configuration changed. Applying stack config so bootstrap servers are refreshed."
  $DOCKER stack deploy --resolve-image never --with-registry-auth --compose-file docker-stack.yml "$STACK_NAME"
else
  for service in "${services[@]}"; do
    full_service="${STACK_NAME}_${service}"
    echo "Updating $full_service to $TARGET_IMAGE..."
    $DOCKER service update --detach=true --with-registry-auth --image "$TARGET_IMAGE" --force "$full_service"
  done
fi

echo "Waiting for selected service task state..."
sleep 15

for service in "${services[@]}"; do
  full_service="${STACK_NAME}_${service}"
  echo ""
  echo "Service status for $full_service:"
  $DOCKER service ps "$full_service" --no-trunc || true
  echo ""
  echo "Current desired task summary for $full_service:"
  $DOCKER service ps "$full_service" \
    --filter desired-state=running \
    --format 'ID={{.ID}} NAME={{.Name}} CURRENT={{.CurrentState}} ERROR={{.Error}}' || true
  echo ""
  echo "Recent logs for $full_service:"
  $DOCKER service logs --tail 60 "$full_service" || true
done

case "$TARGET" in
  grafana)
    curl -fsS "http://127.0.0.1:${GRAFANA_PORT}/api/health" && echo "Grafana is healthy" || echo "Grafana is not ready yet"
    curl -fsS "http://127.0.0.1:${GRAFANA_PORT}${GRAFANA_BASE_PATH}/api/health" && echo "Grafana sub-path is healthy" || echo "Grafana sub-path is not ready yet"
    ;;
  prometheus)
    curl -fsS "http://127.0.0.1:${PROMETHEUS_PORT}${PROMETHEUS_BASE_PATH}/-/healthy" && echo "Prometheus is healthy" || echo "Prometheus is not ready yet"
    if $DOCKER service inspect "${STACK_NAME}_grafana" >/dev/null 2>&1; then
      echo "Restarting Grafana so it reloads the Prometheus datasource provisioning file..."
      $DOCKER service update --detach=true --force "${STACK_NAME}_grafana" || true
    fi
    ;;
  kafka-ui)
    curl -fsS "http://127.0.0.1:${KAFKA_UI_PORT}" >/dev/null && echo "Kafka UI is reachable" || echo "Kafka UI is not ready yet"
    ;;
esac

echo "Selected deployment completed."
EOF

echo "Deployment completed for target: $TARGET"
