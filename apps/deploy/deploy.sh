#!/usr/bin/env bash
set -Eeuo pipefail

cd /opt/cartrune
: "${API_IMAGE:?API_IMAGE is required}"
: "${GHCR_TOKEN:?GHCR_TOKEN is required}"
: "${GHCR_USER:?GHCR_USER is required}"
: "${CARTRUNE_ENV_API:?CARTRUNE_ENV_API is required}"
: "${CARTRUNE_DOMAIN:?CARTRUNE_DOMAIN is required}"

umask 077
printf '%s\n' "$CARTRUNE_ENV_API" > .env.api
jwt_length="$(awk -F= '$1 == "JWT_SECRET" {print length($2); exit}' .env.api)"
test "${jwt_length:-0}" -ge 32
grep -Eq '^CORS_ORIGINS=https?://' .env.api
grep -Eq '^DB_HOST=.*\.pooler\.supabase\.com$' .env.api
grep -Eq '^DB_SSLMODE=(require|verify-ca|verify-full)$' .env.api

previous_image=""
container_id="$(docker compose -f compose.production.yml ps -q api 2>/dev/null || true)"
if [ -n "$container_id" ]; then
  previous_image="$(docker inspect --format '{{.Config.Image}}' "$container_id")"
fi

printf '%s' "$GHCR_TOKEN" | docker login ghcr.io --username "$GHCR_USER" --password-stdin
export API_IMAGE CARTRUNE_DOMAIN
docker compose -f compose.production.yml pull api caddy

# Migrations are serialized by PostgreSQL advisory locking and run before the
# new API container is started. Keep migrations backward-compatible with the
# currently running image.
docker compose -f compose.production.yml run --rm --no-deps \
  --entrypoint /app/cartrune-migrate api

if ! docker compose -f compose.production.yml up -d --remove-orphans; then
  rollback=1
else
  rollback=0
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if curl --fail --silent --show-error "https://${CARTRUNE_DOMAIN}/health/live" >/dev/null; then
      rollback=0
      break
    fi
    rollback=1
    sleep 6
  done
fi

if [ "$rollback" -eq 1 ] && [ -n "$previous_image" ]; then
  echo "deployment failed; rolling back to ${previous_image}"
  export API_IMAGE="$previous_image"
  docker compose -f compose.production.yml up -d --no-deps api
  docker compose -f compose.production.yml up -d caddy
  docker compose -f compose.production.yml ps
  docker compose -f compose.production.yml logs --tail=100 api caddy
  exit 1
fi

if [ "$rollback" -eq 1 ]; then
  docker compose -f compose.production.yml ps
  docker compose -f compose.production.yml logs --tail=100 api caddy
  exit 1
fi

docker compose -f compose.production.yml ps
# Keep tagged images because the previous tag is the rollback target. Remove
# only dangling layers; a separate disk-retention job can delete old tagged
# images after exporting the rollback reference.
docker image prune -f || true
