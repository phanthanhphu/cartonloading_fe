#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/home/bsl-adminit/Projects/cartonloading"
FE_DIR="$PROJECT_ROOT/cartonloading_fe"
IMAGE_NAME="cartonloading_fe:latest"
CONTAINER_NAME="cartonloading_fe"
SERVER_IP="10.232.100.69"

cd "$FE_DIR"

docker build -t "$IMAGE_NAME" \
  --build-arg VITE_APP_VERSION="v1.0.0" \
  --build-arg VITE_APP_BASE_NAME="/" \
  --build-arg VITE_APP_PROTOCOL="http" \
  --build-arg VITE_APP_HOST="$SERVER_IP" \
  --build-arg VITE_API_PORT="8083" \
  --build-arg VITE_API_BASE_URL="http://$SERVER_IP:8083" \
  --build-arg NGINX_CONF="nginx.http.conf" \
  --build-arg APP_PORT="80" \
  .

docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p 3003:80 \
  "$IMAGE_NAME"

echo "Carton Loading FE started on http://$SERVER_IP:3003"
docker ps --filter "name=$CONTAINER_NAME"
