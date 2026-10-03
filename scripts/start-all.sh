#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 no está instalado. Instálalo con: npm install --global pm2" >&2
  exit 1
fi

echo "Iniciando API y Expo con PM2..."
if [[ ! -f "$ROOT_DIR/apps/api/.env" ]]; then
  echo "Falta apps/api/.env con conexión a Supabase." >&2
  exit 1
fi
pm2 startOrRestart ecosystem.config.cjs
pm2 status

echo
echo "Listo. API: http://localhost:8080/health/live"
echo "Logs: pm2 logs"
