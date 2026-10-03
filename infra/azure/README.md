# CartRune en Azure

Despliegue mínimo para `Standard_B2ats_v2` en `chilecentral`.

Servicios en VM:

- API Go.
- Caddy para HTTPS.

Servicios externos:

- Supabase PostgreSQL.
- ScreenScraper WebAPI.
- Gemini API para leer la carátula.

No se despliegan Qdrant, Ollama, MobileCLIP ni un servicio Python de embeddings.

## Configuración inicial

1. Crea `api-cartrune.duckdns.org` en DuckDNS y apunta el registro a IP pública estática de VM.
2. Abre TCP `80` y `443` en NSG. Restringe TCP `22` a tu IP.
3. Instala Docker Compose v2 en VM.
4. Copia `infra/azure/.env.azure.example` a `infra/azure/.env.azure`.
5. Completa Supabase, JWT, ScreenScraper y Gemini.
6. Ejecuta `./infra/azure/deploy-vm.sh`.

Caddy obtiene y renueva certificado HTTPS automáticamente.

## Variables mínimas

```env
CARTRUNE_DOMAIN=api-cartrune.duckdns.org
DB_HOST=...
DB_PORT=5432
DB_USER=...
DB_PASSWORD=...
DB_NAME=postgres
DB_SSLMODE=require
JWT_SECRET=...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite
SS_DEVID=...
SS_DEVPASSWORD=...
SS_SOFTNAME=CartRune
CORS_ORIGINS=*
```

## Actualización

```bash
git pull origin master
./infra/azure/deploy-vm.sh
```

Habrá caída breve mientras Compose reconstruye y reinicia API.
