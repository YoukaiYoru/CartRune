# CartRune backend CI/CD

Deploys one API image to Azure VM through GHCR and Caddy.

Required VM setup:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin curl
sudo usermod -aG docker cartrune
mkdir -p /opt/cartrune
```

Copy these files to `/opt/cartrune`:

- `compose.production.yml`
- `Caddyfile`
- `.env.api`

Set `CARTRUNE_DOMAIN=api-cartrune.duckdns.org` in `.env.api` or shell environment.
Open TCP `80` and `443`. Restrict TCP `22` to your IP.

The API uses Supabase, ScreenScraper and Gemini. It does not use Qdrant,
Ollama or the Python embeddings service.

Deploy manually:

```bash
docker compose -f compose.production.yml config
docker compose -f compose.production.yml pull
docker compose -f compose.production.yml up -d --remove-orphans
docker compose -f compose.production.yml ps
```
