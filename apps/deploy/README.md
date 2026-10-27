# CartRune backend CI/CD

Deploys one API image to Azure VM through GHCR and Caddy.

Required VM setup:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin curl
sudo usermod -aG docker cartrune
mkdir -p /opt/cartrune
```

The GitHub Actions workflow copies these files to `/opt/cartrune` automatically:

- `compose.production.yml`
- `Caddyfile`
- `deploy.sh`
- `.env.api` is generated from the `CARTRUNE_ENV_API` GitHub Environment secret.

Set `CARTRUNE_DOMAIN=api.cartune.tech` in `.env.api` or shell environment.
Open TCP `80` and `443`. Restrict TCP `22` to your IP.

The API uses Supabase, ScreenScraper and Gemini. It does not use Qdrant,
Ollama or the Python embeddings service.

Required GitHub Environment `production` secrets:

- `AZURE_VM_HOST`
- `AZURE_VM_USER`
- `AZURE_VM_SSH_KEY`
- `GHCR_DEPLOY_USER`
- `GHCR_DEPLOY_TOKEN`
- `CARTRUNE_ENV_API` with the complete production `.env.api` content.

Password recovery also requires `RESEND_API_KEY` and a verified `MAIL_FROM` in
`CARTRUNE_ENV_API`. The reset link opens the mobile app through the
`cartrune://reset-password` scheme.

Every push to `master` that changes the API, deployment files or workflow runs tests, publishes the immutable SHA-tagged image to GHCR, copies the deployment files, writes `.env.api`, runs the database migration as a separate one-shot container, starts the new version, checks HTTPS health and rolls back to the previous image if the healthcheck fails. There is no need to enter the VM manually.

The migration command is `/app/cartrune-migrate`. It uses a PostgreSQL advisory
lock, so only one deployment can migrate Supabase at a time. Keep migrations
backward-compatible with the currently running API because the old container
may serve requests while the migration runs.

Manual fallback:

```bash
docker compose -f compose.production.yml config
docker compose -f compose.production.yml pull
docker compose -f compose.production.yml run --rm --no-deps \
  --entrypoint /app/cartrune-migrate api
docker compose -f compose.production.yml up -d --remove-orphans
docker compose -f compose.production.yml ps
```

For a normal release, do not run these commands manually: push to `master` and
wait for the `CI` and `CartRune CD` workflows. Verify afterward with:

```bash
curl --fail https://api.cartune.tech/health/live
curl --fail https://api.cartune.tech/health/ready
```
