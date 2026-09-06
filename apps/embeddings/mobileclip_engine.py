# Engine de embeddings para CartRune.
# Usa MobileCLIP-S0 de Apple (apple/MobileCLIP-S0 en HuggingFace).
# Compartido por el indexador batch (index_covers.py) y el servicio HTTP
# de embedding on-demand (service.py).

import io
import os

import numpy as np
from PIL import Image

import mobileclip
from huggingface_hub import hf_hub_download

"""
Requisitos de entorno:
  MOBILECLIP_CKPT  ruta local del checkpoint (si no existe se descarga
                   automaticamente desde apple/MobileCLIP-S0)
  DEVICE           cpu | cuda (por defecto cpu)
"""

MODEL_NAME = "mobileclip_s0"
HF_REPO = "apple/MobileCLIP-S0"
HF_FILE = "mobileclip_s0.pt"
EMB_DIM = 512


class MobileClipEngine:
    def __init__(self, device=None, ckpt_path=None):
        self.device = device or os.getenv("DEVICE", "cpu")
        ckpt = ckpt_path or os.getenv("MOBILECLIP_CKPT", "")
        if not ckpt or not os.path.exists(ckpt):
            ckpt = self._ensure_checkpoint(ckpt)
        self.ckpt = ckpt

        # create_model_and_transforms devuelve (modelo, tokenizer, image_transform)
        self.model, _, self.image_processor = mobileclip.create_model_and_transforms(
            MODEL_NAME, pretrained=ckpt, device=self.device
        )
        self.model.eval()
        self.dim = EMB_DIM

    def _ensure_checkpoint(self, ckpt):
        """Descarga el checkpoint desde HuggingFace si no existe localmente."""
        if ckpt and os.path.exists(ckpt):
            return ckpt
        return hf_hub_download(repo_id=HF_REPO, filename=HF_FILE)

    def embed_image(self, image):
        """Embedding (dim=512, normalizado) de una imagen de portada."""
        import torch

        img = self.image_processor(image).unsqueeze(0).to(self.device)
        with torch.no_grad():
            vec = self.model.encode_image(img)
            vec = vec / vec.norm(dim=-1, keepdim=True)
        return np.asarray(vec.squeeze(0).cpu()).astype(np.float32).tolist()

    def embed_url(self, url):
        import requests

        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        image = Image.open(io.BytesIO(resp.content)).convert("RGB")
        return self.embed_image(image)