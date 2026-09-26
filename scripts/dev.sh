#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

command -v docker-compose >/dev/null 2>&1 || { echo "Falta docker-compose." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Falta Node.js." >&2; exit 1; }
command -v go >/dev/null 2>&1 || { echo "Falta Go." >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Falta Python 3." >&2; exit 1; }

EXPO_MODE="${DEV_EXPO_MODE:-lan}"
DEV_EXPO_CLIENT="${DEV_EXPO_CLIENT:-1}"
API_HOST="${DEV_API_HOST:-}"
WITH_EMBEDDINGS="${DEV_WITH_EMBEDDINGS:-1}"
WITH_QWEN="${DEV_WITH_QWEN:-0}"
REINDEX="${DEV_REINDEX:-0}"
VISION_PROVIDER="${VISION_PROVIDER:-ollama}"

QWEN_MODEL="${VLLM_MODEL:-Qwen/Qwen2-VL-2B-Instruct-AWQ}"
QWEN_PORT="${VLLM_PORT:-8000}"
QWEN_GPU_MEMORY="${VLLM_GPU_MEMORY_UTILIZATION:-0.65}"
QWEN_MAX_MODEL_LEN="${VLLM_MAX_MODEL_LEN:-512}"

if [[ "$WITH_QWEN" == "1" && "$VISION_PROVIDER" == "vllm" ]]; then
  export VLLM_ENABLED=1
  export VLLM_MODEL="$QWEN_MODEL"
else
  export VLLM_ENABLED=0
fi
export VISION_PROVIDER

if [[ -z "$API_HOST" ]]; then
  if [[ "$EXPO_MODE" == "localhost" ]]; then
    API_HOST="127.0.0.1"
  else
    # hostname -I is unavailable on some macOS/containers; never let LAN
    # discovery terminate the dev runner because of set -e.
    API_HOST="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
    if [[ -z "$API_HOST" ]] && command -v ip >/dev/null 2>&1; then
      API_HOST="$(ip route get 1.1.1.1 2>/dev/null | awk '/src/ {for (i=1; i<=NF; i++) if ($i == "src") print $(i+1); exit}' || true)"
    fi
    API_HOST="${API_HOST:-127.0.0.1}"
  fi
fi

echo "[CartRune] Script activo. Modo Expo: $EXPO_MODE"

if [[ "$WITH_EMBEDDINGS" == "1" ]]; then
  EMBEDDINGS_DIR="$ROOT_DIR/apps/embeddings"
  EMBEDDINGS_PYTHON="$EMBEDDINGS_DIR/.venv/bin/python"
  if [[ ! -x "$EMBEDDINGS_PYTHON" ]]; then
    echo "[CartRune] Creando entorno Python de embeddings..."
    python3 -m venv "$EMBEDDINGS_DIR/.venv"
    echo "[CartRune] Instalando dependencias de MobileCLIP/OCR..."
    "$EMBEDDINGS_DIR/.venv/bin/pip" install -r "$EMBEDDINGS_DIR/requirements.txt"
  fi
fi

if [[ ! -d "$ROOT_DIR/apps/mobile/node_modules" ]]; then
  echo "[CartRune] Instalando dependencias de Expo..."
  (cd "$ROOT_DIR/apps/mobile" && npm install)
fi

echo "[CartRune] Levantando PostgreSQL y Qdrant..."
docker-compose up -d postgres qdrant

echo "[CartRune] Esperando dependencias..."
until docker-compose exec -T postgres pg_isready -U postgres -d cartrune >/dev/null 2>&1; do sleep 2; done
until curl --silent --fail http://localhost:6333/readyz >/dev/null 2>&1; do sleep 2; done

cleanup() {
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "${EMBEDDINGS_PID:-}" ]] && kill "$EMBEDDINGS_PID" 2>/dev/null || true
  [[ -n "${QWEN_PID:-}" ]] && kill "$QWEN_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if curl --silent --fail http://localhost:8080/health/live >/dev/null 2>&1; then
  echo "[CartRune] Ya hay una API ejecutándose en :8080." >&2
  echo "[CartRune] Detén el proceso anterior con Ctrl+C y vuelve a ejecutar este script." >&2
  echo "[CartRune] Diagnóstico: ss -ltnp | grep ':8080'" >&2
  exit 1
fi

echo "[CartRune] API: http://localhost:8080"
(cd apps/api && go run ./cmd/api) & API_PID=$!

until curl --silent --fail http://localhost:8080/health/live >/dev/null 2>&1; do
  if ! kill -0 "$API_PID" 2>/dev/null; then echo "La API terminó antes de estar lista." >&2; exit 1; fi
  sleep 2
done

if [[ "$WITH_EMBEDDINGS" == "1" ]]; then
  EMBEDDINGS_HEALTH="$(curl --silent --fail http://localhost:8700/health 2>/dev/null || true)"
  if [[ "$EMBEDDINGS_HEALTH" == *"\"vision_provider\":\"$VISION_PROVIDER\""* ]]; then
    echo "[CartRune] Embeddings ya estaba activo en :8700 con $VISION_PROVIDER; se reutiliza."
  elif [[ -n "$EMBEDDINGS_HEALTH" ]]; then
    echo "[CartRune] Hay un embeddings antiguo en :8700 con configuración incompatible." >&2
    echo "[CartRune] Detén el proceso que ocupa ese puerto y vuelve a ejecutar el script." >&2
    exit 1
  else
    echo "[CartRune] Embeddings: http://localhost:8700"
    (cd apps/embeddings && "$EMBEDDINGS_PYTHON" service.py) & EMBEDDINGS_PID=$!
    until curl --silent --fail http://localhost:8700/health >/dev/null 2>&1; do
      if ! kill -0 "$EMBEDDINGS_PID" 2>/dev/null; then
        echo "El servicio de embeddings terminó antes de estar listo." >&2
        exit 1
      fi
      sleep 2
    done
  fi
  echo "[CartRune] Embeddings listo. Analizador visual: $VISION_PROVIDER"
fi

if [[ "$WITH_QWEN" == "1" && "$VISION_PROVIDER" == "vllm" ]]; then
  if curl --silent --fail "http://127.0.0.1:${QWEN_PORT}/v1/models" >/dev/null 2>&1; then
    echo "[CartRune] vLLM ya estaba activo en :${QWEN_PORT}; se reutiliza."
  else
    if [[ "$WITH_EMBEDDINGS" != "1" ]]; then
      echo "DEV_WITH_QWEN=1 requiere DEV_WITH_EMBEDDINGS=1." >&2
      exit 1
    fi
    echo "[CartRune] Qwen visual: $QWEN_MODEL"
    echo "[CartRune] Iniciando vLLM en http://127.0.0.1:${QWEN_PORT}..."
    (cd apps/embeddings && \
      "$EMBEDDINGS_PYTHON" -m vllm.entrypoints.openai.api_server \
        --model "$QWEN_MODEL" \
        --served-model-name "$QWEN_MODEL" \
        --host 127.0.0.1 \
        --port "$QWEN_PORT" \
        --dtype float16 \
        --max-model-len "$QWEN_MAX_MODEL_LEN" \
        --max-num-seqs 1 \
        --enforce-eager \
        --gpu-memory-utilization "$QWEN_GPU_MEMORY") & QWEN_PID=$!
    until curl --silent --fail "http://127.0.0.1:${QWEN_PORT}/v1/models" >/dev/null 2>&1; do
      if ! kill -0 "$QWEN_PID" 2>/dev/null; then
        echo "vLLM no pudo iniciar. Revisa la causa de VRAM/modelo en los logs." >&2
        exit 1
      fi
      sleep 2
    done
  fi
  echo "[CartRune] Qwen listo. Modelo: $QWEN_MODEL"
fi

if [[ "$REINDEX" == "1" ]]; then
  if [[ "$WITH_EMBEDDINGS" != "1" ]]; then
    echo "DEV_REINDEX=1 requiere embeddings habilitado." >&2
    exit 1
  fi
  echo "[CartRune] Reconstruyendo índice visual de portadas..."
  (cd apps/embeddings && \
    POSTGRES_DSN="postgresql://postgres:postgres@localhost:5432/cartrune" \
    QDRANT_URL="http://localhost:6333" \
    MEDIA_BASE_URL="http://localhost:8080" \
    "$EMBEDDINGS_PYTHON" index_covers.py)
  echo "[CartRune] Índice visual listo."
fi

export EXPO_PUBLIC_API_HOST="$API_HOST"
echo
if [[ "$DEV_EXPO_CLIENT" == "1" ]]; then
  echo "[CartRune] Expo se iniciará en modo development client ($EXPO_MODE)."
else
  echo "[CartRune] Expo se iniciará en modo Expo Go ($EXPO_MODE)."
fi
echo "[CartRune] API visible para el móvil: http://$API_HOST:8080"
if [[ "$DEV_EXPO_CLIENT" == "1" ]]; then
  echo "[CartRune] Abre el development build instalado en el dispositivo. Ctrl+C detiene los procesos."
else
  echo "[CartRune] Escanea el QR que aparecerá abajo con Expo Go. Ctrl+C detiene los procesos."
fi
echo

cd apps/mobile
EXPO_ARGS=(start)
if [[ "$DEV_EXPO_CLIENT" == "1" ]]; then
  EXPO_ARGS+=(--dev-client)
fi
case "$EXPO_MODE" in
  tunnel) exec npx expo "${EXPO_ARGS[@]}" --tunnel ;;
  localhost) exec npx expo "${EXPO_ARGS[@]}" --localhost ;;
  *) exec npx expo "${EXPO_ARGS[@]}" --lan ;;
esac
