#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
command -v go >/dev/null 2>&1 || { echo "Falta Go." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Falta Node.js." >&2; exit 1; }

if [[ ! -f apps/api/.env ]]; then
  echo "Falta apps/api/.env con conexión a Supabase." >&2
  exit 1
fi

(cd apps/api && go run ./cmd/api) & API_PID=$!
trap 'kill "$API_PID" 2>/dev/null || true' EXIT INT TERM
until curl --silent --fail http://localhost:8080/health/live >/dev/null 2>&1; do sleep 2; done
export EXPO_PUBLIC_API_HOST="${DEV_API_HOST:-127.0.0.1}"
cd apps/mobile
exec npx expo start --lan
