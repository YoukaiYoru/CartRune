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
- `.env.api` is generated from the `CARTRUNE_ENV_API` GitHub Environment secret.

Set `CARTRUNE_DOMAIN=api-cartrune.duckdns.org` in `.env.api` or shell environment.
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

Every push to `master` that changes the API, deployment files or workflow runs tests, publishes the image to GHCR, copies Caddy/Compose, writes `.env.api`, and restarts the services. There is no need to enter the VM manually.

Manual fallback:

```bash
docker compose -f compose.production.yml config
docker compose -f compose.production.yml pull
docker compose -f compose.production.yml up -d --remove-orphans
docker compose -f compose.production.yml ps
```
