#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/azure/docker-compose.azure.yml"
ENV_FILE="$ROOT_DIR/infra/azure/.env.azure"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.azure.example and fill in values." >&2
  exit 1
fi

for required in DB_HOST DB_USER DB_PASSWORD JWT_SECRET GEMINI_API_KEY SS_DEVID SS_DEVPASSWORD; do
  value="$(awk -F= -v key="$required" '$1 == key {print substr($0, index($0, "=") + 1)}' "$ENV_FILE")"
  if [[ -z "$value" || "$value" == replace-* || "$value" == YOUR_* ]]; then
    echo "Missing or placeholder value for $required in $ENV_FILE" >&2
    exit 1
  fi
done

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config >/dev/null
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build --remove-orphans

domain="$(awk -F= '$1 == "CARTRUNE_DOMAIN" {print substr($0, index($0, "=") + 1)}' "$ENV_FILE")"
domain="${domain:-api-cartrune.duckdns.org}"
curl --fail --silent --show-error "https://${domain}/health/live"
echo
