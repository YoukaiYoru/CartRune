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
import os

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image

from mobileclip_engine import MobileClipEngine
from ocr_engine import OcrEngine

app = FastAPI(title="CartRune Embeddings")
engine = MobileClipEngine()
_ocr = None


def get_ocr():
    global _ocr
    if _ocr is None:
        _ocr = OcrEngine()
    return _ocr


@app.get("/health")
def health():
    return {"status": "ok", "dim": engine.dim}


@app.post("/embed")
async def embed(image: UploadFile = File(...)):
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="expected an image file")
    try:
        data = await image.read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="unable to read image")

    try:
        vec = engine.embed_image(img)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"embedding failed: {exc}")

    return {"embedding": vec, "dim": len(vec)}


@app.post("/ocr")
async def ocr(image: UploadFile = File(...)):
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="expected an image file")
    try:
        data = await image.read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="unable to read image")

    try:
        text = get_ocr().read_text(img)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"ocr failed: {exc}")

    return {"text": text}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("EMBEDDINGS_PORT", "8700"))
    uvicorn.run(app, host="0.0.0.0", port=port)