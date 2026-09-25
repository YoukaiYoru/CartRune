# Embeddings y Qdrant

El scanner usa MobileCLIP para comparar la imagen y un analizador visual
opcional para extraer título, consola, región, edición y publisher. El
analizador puede usar Ollama o vLLM; el servicio de embeddings no guarda las
imágenes.

Instalación local (PM2):

```bash
cd apps/embeddings
python -m pip install -r requirements.txt
python service.py
```

Para trabajar solo con MobileCLIP + OCR:

```bash
VISION_PROVIDER=disabled python service.py

Para usar el Ollama local que ya tienes:

```bash
ollama serve # si todavía no está ejecutándose
VISION_PROVIDER=ollama \
OLLAMA_MODEL=gemma3:4b \
python service.py
```

Ollama expone el analizador en `http://127.0.0.1:11434/api/chat`. El servicio
convierte la imagen a Base64 en memoria y devuelve siempre el contrato JSON de
CartRune.
```

En una GPU de 4 GB usa el checkpoint cuantizado de 2B:

```bash
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2-VL-2B-Instruct-AWQ \
  --served-model-name Qwen/Qwen2-VL-2B-Instruct-AWQ \
  --host 127.0.0.1 \
  --port 8000 \
  --dtype float16 \
  --max-model-len 512 \
  --max-num-seqs 1 \
  --enforce-eager \
  --gpu-memory-utilization 0.65
```

Luego configura el servicio de embeddings:

```env
VLLM_BASE_URL=http://localhost:8000/v1
VLLM_MODEL=Qwen/Qwen2-VL-2B-Instruct-AWQ
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
