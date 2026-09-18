# Embeddings y Qdrant

El scanner usa dos señales: MobileCLIP para comparar la imagen y Qwen2-VL para
extraer título, consola, región, edición y publisher. Qwen2-VL se sirve desde
vLLM mediante su API compatible con OpenAI; el servicio de embeddings no carga
el modelo ni guarda las imágenes.

Instalación local (PM2):

```bash
cd apps/embeddings
python -m pip install -r requirements.txt
python service.py
```

Para desactivar el análisis visual de Qwen2-VL sin perder el match visual:

```bash
VLLM_ENABLED=0 python service.py
```

Inicia vLLM con el modelo del repositorio `xwjim/Qwen2-VL`:

```bash
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2-VL-7B-Instruct \
  --served-model-name Qwen2-VL-7B-Instruct \
  --host 0.0.0.0 \
  --port 8000
```

Luego configura el servicio de embeddings:

```env
VLLM_BASE_URL=http://localhost:8000/v1
VLLM_MODEL=Qwen2-VL-7B-Instruct
VLLM_API_KEY=
```

La API key es opcional cuando vLLM corre localmente. No publiques el puerto
8000 directamente en Internet si lo dejas sin autenticación; mantenlo en
`localhost`, una red privada o detrás de una capa de autenticación.

El repositorio recomienda vLLM `>=0.6.1` para Qwen2-VL y expone
`POST /v1/chat/completions` con imágenes como `image_url`.

El índice visual se puede reconstruir con el perfil `index` de Compose:

```bash
docker-compose --profile index run --rm indexer
```

El job lee las carátulas de PostgreSQL, genera embeddings MobileCLIP y hace
upsert en la colección `game_covers` de Qdrant. Es idempotente y puede
ejecutarse después de importar nuevos juegos o como tarea programada.

Para revisar el estado del índice:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/scanner/stats
```
