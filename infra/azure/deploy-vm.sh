#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/azure/docker-compose.azure.yml"
ENV_FILE="$ROOT_DIR/infra/azure/.env.azure"

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif docker-compose --version >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "Docker Compose v2 is required." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.azure.example and fill in the external DB/Qdrant values." >&2
  exit 1
fi

"${COMPOSE[@]}" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config >/dev/null
"${COMPOSE[@]}" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build

echo "Waiting for the embeddings service..."
for _ in {1..40}; do
  if curl --fail --silent http://127.0.0.1:8700/health >/dev/null; then
    break
  fi
  sleep 3
done

MODEL="$(awk -F= '$1 == "OLLAMA_MODEL" {print substr($0, index($0, "=") + 1)}' "$ENV_FILE")"
MODEL="${MODEL:-gemma3:4b}"
echo "Pulling $MODEL into the persistent Ollama volume..."
"${COMPOSE[@]}" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T ollama ollama pull "$MODEL"
"${COMPOSE[@]}" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" restart embeddings

echo "API health:"
curl --fail --silent http://127.0.0.1:8080/health/live
echo
