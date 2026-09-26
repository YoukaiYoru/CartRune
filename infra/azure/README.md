# CartRune: API + Ollama en Azure

Esta configuración despliega únicamente la API Go, el servicio Python de embeddings y Ollama. PostgreSQL y Qdrant son servicios externos y deben ser accesibles desde la VM de Azure, preferiblemente mediante Tailscale o una red privada.

La configuración inicial usa `APP_ENV=staging` y HTTP en el puerto 8080 para facilitar la primera comprobación desde la app móvil. Antes de una publicación real, coloca HTTPS delante de la API y cambia `APP_ENV` a `production`; el binario exige certificados cuando se usa ese entorno.

## Requisitos de la VM

- Ubuntu 22.04
- 2 vCPU y al menos 8 GiB de RAM para `gemma3:4b`
- Docker Engine y Docker Compose v2
- Puerto público: solo `8080` (la API)
- No exponer públicamente `5432`, `6333`, `6334` ni `11434`

## Primer despliegue

```bash
cd /ruta/CartRune
cp infra/azure/.env.azure.example infra/azure/.env.azure
nano infra/azure/.env.azure
chmod +x infra/azure/deploy-vm.sh
./infra/azure/deploy-vm.sh
```

El script valida la configuración, construye los dos servicios de CartRune, levanta Ollama, descarga el modelo configurado y comprueba `/health/live`.

## Actualizar

```bash
git pull
./infra/azure/deploy-vm.sh
```

## Diagnóstico

```bash
docker compose --env-file infra/azure/.env.azure \
  -f infra/azure/docker-compose.azure.yml ps

docker compose --env-file infra/azure/.env.azure \
  -f infra/azure/docker-compose.azure.yml logs -f api embeddings ollama
```

## Configuración móvil

Usa la IP pública o el dominio HTTPS de la VM en `apps/mobile/.env`:

```env
EXPO_PUBLIC_API_HOST=http://IP_PUBLICA:8080
```

Para producción, coloca HTTPS delante de la API con un dominio y Caddy, Azure Application Gateway o Cloudflare Tunnel. No publiques Ollama directamente.
