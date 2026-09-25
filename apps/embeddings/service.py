# Servicio HTTP de embedding on-demand.
#
# Expone el embedding MobileCLIP de una foto de portada para que la app
# pueda resolver el vector y llamar despues a POST /api/v1/scanner/match
# del backend CartRune (que busca en Qdrant). Tambien expone OCR server-side
# (EasyOCR) para leer el titulo de la portada desde Expo Go, donde los
# modulos nativos (expo-mlkit-ocr) no estan disponibles.
#
# Uso:
#   cd apps/embeddings && pip install -r requirements.txt
#   uvicorn service:app --host 0.0.0.0 --port 8700
#
# Endpoints:
#   GET  /health            -> {"status": "ok"}
#   POST /embed             -> multipart file "image" -> {"embedding": [...]}
#   POST /ocr               -> multipart file "image" -> {"text": "<linea>"}

import io
import logging
import os
import time

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image
from starlette.concurrency import run_in_threadpool

from mobileclip_engine import MobileClipEngine
from ocr_engine import OcrEngine
from qwen_engine import VISION_PROVIDER, analyze_cover as qwen_analyze_cover

app = FastAPI(title="CartRune Embeddings")
logger = logging.getLogger("cartrune.embeddings")
logger.setLevel(logging.INFO)
engine = MobileClipEngine()
_ocr = None


def get_ocr():
    global _ocr
    if _ocr is None:
        _ocr = OcrEngine()
    return _ocr


@app.get("/health")
def health():
    return {
        "status": "ok",
        "dim": engine.dim,
        "vision_provider": VISION_PROVIDER,
        "vision_model": os.getenv("OLLAMA_MODEL", "gemma3:4b") if VISION_PROVIDER == "ollama" else os.getenv("VLLM_MODEL", "Qwen/Qwen2-VL-2B-Instruct-AWQ"),
        "ollama_base_url": os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
        "vllm_base_url": os.getenv("VLLM_BASE_URL", "http://localhost:8000/v1"),
    }


@app.post("/analyze-cover")
async def analyze_cover(image: UploadFile = File(...)):
    """Extract catalog hints from a cover with the configured vision provider."""
    # Visual MobileCLIP remains available when the optional vision provider is
    # disabled in local development. Return a valid empty analysis instead of
    # turning an optional enrichment step into a scanner failure/noisy 503.
    if VISION_PROVIDER in {"", "disabled", "none", "off"}:
        return {
            "title": "",
            "console": "",
            "region": "",
            "edition": "",
            "publisher": "",
            "query": "",
        }
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="expected an image file")
    try:
        data = await image.read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
        # Qwen es CPU-bound; no bloquear el event loop mientras analiza.
        result = await run_in_threadpool(qwen_analyze_cover, img)
        result["query"] = " ".join(filter(None, [result["title"], result["edition"], result["region"]]))
        return result
    except RuntimeError as exc:
        logger.warning("vision provider unavailable provider=%s: %s", VISION_PROVIDER, exc)
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.exception("vision cover analysis failed provider=%s", VISION_PROVIDER)
        raise HTTPException(status_code=500, detail=f"cover analysis failed: {exc}")


@app.post("/embed")
async def embed(image: UploadFile = File(...)):
    started = time.perf_counter()
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="expected an image file")
    try:
        data = await image.read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="unable to read image")

    try:
        # MobileCLIP también es CPU-bound y puede tardar en equipos pequeños.
        vec = await run_in_threadpool(engine.embed_image, img)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"embedding failed: {exc}")

    logger.info("cover analyzed operation=embedding bytes=%d dim=%d duration_ms=%d", len(data), len(vec), (time.perf_counter() - started) * 1000)
    return {"embedding": vec, "dim": len(vec)}


@app.post("/ocr")
async def ocr(image: UploadFile = File(...)):
    started = time.perf_counter()
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="expected an image file")
    try:
        data = await image.read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="unable to read image")

    try:
        text = await run_in_threadpool(get_ocr().read_text, img)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"ocr failed: {exc}")

    logger.info("cover analyzed operation=ocr bytes=%d text_detected=%s duration_ms=%d", len(data), bool(text.strip()), (time.perf_counter() - started) * 1000)
    return {"text": text}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("EMBEDDINGS_PORT", "8700"))
    uvicorn.run(app, host="0.0.0.0", port=port)
