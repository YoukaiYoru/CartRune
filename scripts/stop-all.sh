#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if command -v pm2 >/dev/null 2>&1; then
	pm2 delete cartrune-api cartrune-mobile 2>/dev/null || true
fi

echo "CartRune detenido."
