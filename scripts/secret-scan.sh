#!/usr/bin/env bash
set -euo pipefail

matches="$(git grep -n -I -E \
  '(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|JWT_SECRET=[^[:space:]#]{16,}|SS_DEVPASSWORD=[^[:space:]#]+|SS_USERPASSWORD=[^[:space:]#]+)' \
  -- ':!apps/api/.env.example' ':!apps/api/internal/screenscraper/testdata/*' || true)"

if [[ -n "$matches" ]]; then
  echo "Potential secrets detected:"
  echo "$matches"
  exit 1
fi
echo "secret_scan_ok"
