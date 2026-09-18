#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL_DIR="$ROOT_DIR/apps/embeddings/models/Qwen3.5-0.8B"
MOBILECLIP_DIR="$ROOT_DIR/apps/embeddings/models"
PYTHON="$ROOT_DIR/apps/embeddings/.venv/bin/python"

if [[ ! -x "$PYTHON" ]]; then
  echo "No existe el entorno virtual de embeddings: $PYTHON" >&2
  echo "Ejecuta primero ./scripts/start-all.sh o crea el .venv." >&2
  exit 1
fi

mkdir -p "$MODEL_DIR"
echo "Descargando Qwen3.5-0.8B en: $MODEL_DIR"
"$PYTHON" -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='Qwen/Qwen3.5-0.8B', local_dir='$MODEL_DIR')"
echo "Modelo local listo. Qwen lo usará automáticamente en el próximo arranque."
echo "Descargando MobileCLIP en: $MOBILECLIP_DIR/mobileclip_s0.pt"
"$PYTHON" -c "from huggingface_hub import hf_hub_download; hf_hub_download(repo_id='apple/MobileCLIP-S0', filename='mobileclip_s0.pt', local_dir='$MOBILECLIP_DIR')"
echo "MobileCLIP local listo. El servicio ya no necesitará consultar HF al arrancar."
