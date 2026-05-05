#!/bin/bash

set -euo pipefail

#############################################
# CONFIGURATION
#############################################
PROJECT_DIR="/c/Users/Prasad.N/WorkSpace/mach/pronessmart"
REMOTE_USER="svcadm"
REMOTE_DIR="/tmp/services-integration"
STACK_NAME="services-integration"
EXPORT_DIR="/d/docker-exports/services-integration"

STACK_FILE="docker-stack.yml"
ENV_FILE=".env.prod"
REMOTE_HOST="$(grep -E '^SERVER_HOST=' "$PROJECT_DIR/$ENV_FILE" | cut -d '=' -f2-)"

if [ -z "$REMOTE_HOST" ]; then
  echo "SERVER_HOST is missing in $PROJECT_DIR/$ENV_FILE"
  exit 1
fi

#############################################
# STEP 1: VALIDATE LOCAL FILES
#############################################
echo "Step 1: Validating local deployment files..."

cd "$PROJECT_DIR"

for file in "$STACK_FILE" "$ENV_FILE" "monitoring/prometheus/prometheus.yml" \
  "monitoring/prometheus/alerts-prod.yml" \
  "monitoring/grafana/provisioning/datasources/prometheus.yml" \
  "monitoring/grafana/provisioning/dashboards/dashboard.yml"; do
  if [ ! -f "$file" ]; then
    echo "Missing required file: $file"
    exit 1
  fi
done

if [ ! -d "monitoring/grafana/dashboards" ]; then
  echo "Missing required directory: monitoring/grafana/dashboards"
  exit 1
fi

echo "Loading production environment locally..."
set -a
. "$ENV_FILE"
set +a

if [ "${GRAFANA_IMAGE:-}" = "grafana/grafana:latest" ]; then
  echo "GRAFANA_IMAGE must not use latest in $ENV_FILE. Use a pinned version such as grafana/grafana:10.4.6."
  exit 1
fi

if [ "${GRAFANA_BASE_PATH:-}" != "/grafana" ]; then
  echo "GRAFANA_BASE_PATH is expected to be /grafana for the current Nginx route."
  exit 1
fi

IMAGES=(
  "$REDIS_IMAGE"
  "$ZOOKEEPER_IMAGE"
  "$KAFKA_IMAGE"
  "$KAFKA_UI_IMAGE"
  "$PROMETHEUS_IMAGE"
  "$GRAFANA_IMAGE"
  "$NODE_EXPORTER_IMAGE"
  "$CADVISOR_IMAGE"
)

#############################################
# STEP 2: EXPORT PUBLIC IMAGES
#############################################
echo "Step 2: Pulling and exporting public images locally..."

mkdir -p "$EXPORT_DIR"

for image in "${IMAGES[@]}"; do
  image_tar_name="$(echo "$image" | tr '/:' '__').tar"
  image_tar_path="$EXPORT_DIR/$image_tar_name"
  echo "Pulling $image..."
  docker pull "$image"
  echo "Saving $image to $image_tar_path..."
  docker save -o "$image_tar_path" "$image"
done

#############################################
# STEP 3: COPY FILES TO REMOTE SERVER
#############################################
echo "Step 3: Copying stack, images, and monitoring configuration to $REMOTE_HOST..."

ssh "$REMOTE_USER@$REMOTE_HOST" "rm -rf '$REMOTE_DIR/images' '$REMOTE_DIR/monitoring/prometheus' '$REMOTE_DIR/monitoring/grafana/provisioning' '$REMOTE_DIR/monitoring/grafana/dashboards' && mkdir -p '$REMOTE_DIR/images' '$REMOTE_DIR/monitoring/prometheus' '$REMOTE_DIR/monitoring/grafana/provisioning/datasources' '$REMOTE_DIR/monitoring/grafana/provisioning/dashboards' '$REMOTE_DIR/monitoring/grafana/dashboards'"

scp "$STACK_FILE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"
scp "$ENV_FILE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"
scp "$EXPORT_DIR"/*.tar "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/images/"
scp "monitoring/prometheus/prometheus.yml" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/monitoring/prometheus/"
scp "monitoring/prometheus/alerts-prod.yml" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/monitoring/prometheus/"
scp "monitoring/grafana/provisioning/datasources/prometheus.yml" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/monitoring/grafana/provisioning/datasources/"
scp "monitoring/grafana/provisioning/dashboards/dashboard.yml" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/monitoring/grafana/provisioning/dashboards/"
scp -r "monitoring/grafana/dashboards/." "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/monitoring/grafana/dashboards/"

#############################################
# STEP 4: DEPLOY ON REMOTE SERVER
#############################################
echo "Step 4: Deploying Docker Swarm stack on $REMOTE_HOST..."

ssh -t "$REMOTE_USER@$REMOTE_HOST" "REMOTE_DIR='$REMOTE_DIR' STACK_NAME='$STACK_NAME' bash -s" <<'EOF'
set -euo pipefail

cd "$REMOTE_DIR"

DOCKER="docker"
if ! docker info >/dev/null 2>&1; then
  DOCKER="sudo -E docker"
fi

echo "Checking Docker Swarm status..."
if ! $DOCKER info --format '{{.Swarm.LocalNodeState}}' | grep -qi active; then
  echo "Docker Swarm is not active. Initialize it on this server first:"
  echo "  docker swarm init --advertise-addr 172.20.104.100"
  exit 1
fi

echo "Loading production environment..."
set -a
. ./.env.prod
set +a

if [ "${GRAFANA_IMAGE:-}" = "grafana/grafana:latest" ]; then
  echo "Refusing to deploy Grafana with the latest tag. Check $REMOTE_DIR/.env.prod."
  exit 1
fi

if [ "${GRAFANA_BASE_PATH:-}" != "/grafana" ]; then
  echo "Refusing to deploy with unexpected GRAFANA_BASE_PATH=${GRAFANA_BASE_PATH:-unset}."
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

echo "Loading Docker images from uploaded tar files..."
for tar_file in images/*.tar; do
  [ -f "$tar_file" ] || continue
  $DOCKER load -i "$tar_file"
done

echo "Rendering Docker stack for verification..."
$DOCKER stack config --compose-file docker-stack.yml > rendered-stack.yml

echo "Rendered service images:"
grep -E '^[[:space:]]+image:' rendered-stack.yml || true

if grep -q 'grafana/grafana:latest' rendered-stack.yml; then
  echo "Rendered stack still contains grafana/grafana:latest; aborting before deploy."
  echo "Check .env.prod upload and shell variable expansion on the server."
  exit 1
fi

if ! grep -q "image: ${GRAFANA_IMAGE}" rendered-stack.yml; then
  echo "Rendered stack does not contain expected Grafana image ${GRAFANA_IMAGE}; aborting before deploy."
  exit 1
fi

echo "Deploying stack: $STACK_NAME"
$DOCKER stack deploy --resolve-image never --with-registry-auth --compose-file docker-stack.yml "$STACK_NAME"

echo "Waiting for services to start..."
sleep 15

echo "Stack services:"
$DOCKER stack services "$STACK_NAME"

echo "Stack tasks:"
$DOCKER stack ps "$STACK_NAME" --no-trunc

echo "Kafka UI bootstrap configuration:"
$DOCKER service inspect "${STACK_NAME}_kafka-ui" --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep -E 'KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS|KAFKA_CLUSTERS_0_ZOOKEEPER' || true

echo "Grafana service image:"
$DOCKER service inspect "${STACK_NAME}_grafana" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' || true

print_recent_failures() {
  service_name="$1"
  echo ""
  echo "Recent task history for ${service_name}:"
  $DOCKER service ps "${STACK_NAME}_${service_name}" --no-trunc || true
  echo ""
  echo "Recent logs for ${service_name}:"
  $DOCKER service logs --tail 80 "${STACK_NAME}_${service_name}" || true
}

if $DOCKER service ps "${STACK_NAME}_grafana" --filter desired-state=shutdown --format '{{.CurrentState}} {{.Error}}' | grep -Eq 'Failed|Rejected|non-zero|No such image'; then
  print_recent_failures "grafana"
fi

for kafka_service in kafka-1 kafka-2 kafka-3; do
  if $DOCKER service ps "${STACK_NAME}_${kafka_service}" --filter desired-state=shutdown --format '{{.CurrentState}} {{.Error}}' | grep -Eq 'Failed|Rejected|non-zero|137|No such image'; then
    print_recent_failures "$kafka_service"
  fi
done

echo "Endpoint checks from the server:"
curl -fsS "http://127.0.0.1:${KAFKA_UI_PORT}" >/dev/null && echo "Kafka UI is reachable on port ${KAFKA_UI_PORT}" || echo "Kafka UI is not ready yet"
curl -fsS "http://127.0.0.1:${PROMETHEUS_PORT}${PROMETHEUS_BASE_PATH}/-/healthy" && echo "Prometheus is healthy" || echo "Prometheus is not ready yet"
curl -fsS "http://127.0.0.1:${GRAFANA_PORT}/api/health" && echo "Grafana is healthy" || echo "Grafana is not ready yet"
curl -fsS "http://127.0.0.1:${GRAFANA_PORT}${GRAFANA_BASE_PATH}/api/health" && echo "Grafana sub-path is healthy" || echo "Grafana sub-path is not ready yet"

if command -v nginx >/dev/null 2>&1; then
  echo "Checking whether local Nginx knows the /grafana route..."
  if nginx -T 2>/dev/null | grep -q 'location /grafana/'; then
    echo "Nginx has a /grafana/ location block."
  else
    echo "Nginx does not show a /grafana/ location block. http://${SERVER_HOST}/grafana/ will return an Nginx 404 until the active Nginx config is updated and reloaded."
  fi
fi

echo "Deployment command completed."
EOF

#############################################
# FINAL MESSAGE
#############################################
echo "Deployment completed. Open:"
echo "  Kafka UI:   http://$REMOTE_HOST:$(grep -E '^KAFKA_UI_PORT=' "$PROJECT_DIR/$ENV_FILE" | cut -d '=' -f2-)"
echo "  Prometheus: http://$REMOTE_HOST:$(grep -E '^PROMETHEUS_PORT=' "$PROJECT_DIR/$ENV_FILE" | cut -d '=' -f2-)"
echo "  Grafana:    http://$REMOTE_HOST:$(grep -E '^GRAFANA_PORT=' "$PROJECT_DIR/$ENV_FILE" | cut -d '=' -f2-)$(grep -E '^GRAFANA_BASE_PATH=' "$PROJECT_DIR/$ENV_FILE" | cut -d '=' -f2-)/"
echo ""
echo "If http://$REMOTE_HOST/grafana/ returns 404, update and reload the server's active Nginx config to proxy /grafana/ to 127.0.0.1:$(grep -E '^GRAFANA_PORT=' "$PROJECT_DIR/$ENV_FILE" | cut -d '=' -f2-)."
