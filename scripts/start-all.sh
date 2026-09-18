#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 no está instalado. Instálalo con: npm install --global pm2" >&2
  exit 1
fi

if ! command -v docker-compose >/dev/null 2>&1; then
  echo "No se encontró docker-compose; se necesita para PostgreSQL y Qdrant." >&2
  exit 1
fi

EMBEDDINGS_DIR="$ROOT_DIR/apps/embeddings"
EMBEDDINGS_PYTHON="$EMBEDDINGS_DIR/.venv/bin/python"
if [[ ! -x "$EMBEDDINGS_PYTHON" ]]; then
  echo "Creando entorno virtual de embeddings..."
  python3 -m venv "$EMBEDDINGS_DIR/.venv"
fi

if ! "$EMBEDDINGS_PYTHON" -c 'import fastapi, requests, PIL, torch' >/dev/null 2>&1; then
  echo "Faltan dependencias de embeddings. Ejecuta:"
  echo "  $EMBEDDINGS_PYTHON -m pip install -r $EMBEDDINGS_DIR/requirements.txt"
  exit 1
fi

echo "Iniciando PostgreSQL y Qdrant..."
docker-compose up -d postgres qdrant

echo "Esperando a PostgreSQL..."
until docker-compose exec -T postgres pg_isready -U postgres -d cartrune >/dev/null 2>&1; do
  sleep 2
done

echo "Esperando a Qdrant..."
until curl --silent --fail http://localhost:6333/readyz >/dev/null; do
  sleep 2
done

echo "Iniciando API, embeddings y Expo con PM2..."
pm2 startOrRestart ecosystem.config.cjs
pm2 status

echo
echo "Listo. API: http://localhost:8080/health/live"
echo "Logs: pm2 logs"
