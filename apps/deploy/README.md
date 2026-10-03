# CartRune backend CI/CD

El workflow `.github/workflows/ci-cd.yml` ejecuta tests, construye dos imágenes
y las publica en GHCR:

- `ghcr.io/youkaiyoru/cartrune-api`
- `ghcr.io/youkaiyoru/cartrune-embeddings`

Al hacer push a `main`, copia Compose a la VM, hace login en GHCR, descarga las
imágenes y reinicia los servicios. Supabase y Qdrant permanecen externos.

## 1. Preparar la VM de Azure

Entra como `cartrune` y ejecuta una vez:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin curl
sudo usermod -aG docker cartrune
exit
```

Vuelve a entrar y crea los directorios:

```bash
sudo mkdir -p /opt/cartrune/certs
sudo chown -R cartrune:cartrune /opt/cartrune
```

La API exige TLS en `APP_ENV=production`. Coloca el certificado y clave en:

```text
/opt/cartrune/certs/fullchain.pem
/opt/cartrune/certs/privkey.pem
```

No abras el puerto 8700 de embeddings. El Compose lo mantiene únicamente en
la red interna. En el NSG de Azure deja SSH restringido a tu IP y publica solo
el puerto HTTPS que uses para la API.

## 2. Crear configuración en la VM

```bash
cd /opt/cartrune
# Copia los dos archivos example desde el repositorio antes de ejecutar esto.
cp .env.api.example .env.api
cp .env.embeddings.example .env.embeddings
chmod 600 .env.api .env.embeddings
nano .env.api
nano .env.embeddings
```

Los valores importantes son:

- Supabase: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=postgres`,
  `DB_SSLMODE=require`.
- JWT: `JWT_SECRET` aleatorio y largo.
- Qdrant: `QDRANT_HOST`, `QDRANT_PORT=6334`, `QDRANT_API_KEY` y
  `QDRANT_USE_TLS=true` si usas Qdrant Cloud.
- ScreenScraper: sus credenciales y límites.
- Embeddings: `DEVICE=cpu` y el checkpoint MobileCLIP incluido en la imagen.

## 3. Configurar secretos de GitHub

Crea un Environment llamado `production` en GitHub y agrega:

```text
AZURE_VM_HOST=57.156.57.38       # mejor: un dominio estable
AZURE_VM_USER=cartrune
AZURE_VM_SSH_KEY=<clave privada SSH completa>
GHCR_DEPLOY_USER=YoukaiYoru
GHCR_DEPLOY_TOKEN=<token con read:packages>
```

La clave pública correspondiente debe estar en:

```text
/home/cartrune/.ssh/authorized_keys
```

El token de GHCR solo se usa en la VM para descargar imágenes privadas. No lo
guardes en `.env` del repositorio.

## 4. Primera ejecución manual

Antes del primer deploy automático, copia los ejemplos a la VM y valida:

```bash
cd /opt/cartrune
docker compose -f compose.production.yml config
```

Después del primer workflow:

```bash
docker compose -f compose.production.yml ps
docker compose -f compose.production.yml logs --tail=100 api embeddings
curl -k https://127.0.0.1:8080/health/live
docker compose -f compose.production.yml exec embeddings \
  python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8700/health').read().decode())"
```

El schema de Supabase se mantiene actualmente mediante `AutoMigrate` al iniciar
la API. Para una fase posterior conviene migrar a migraciones versionadas y
ejecutarlas como job controlado antes del `docker compose up`.
