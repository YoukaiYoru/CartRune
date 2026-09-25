"""Vision-model cover analysis through Ollama or a vLLM-compatible server.

The image is kept in memory and sent to the configured provider. This module
only adapts the provider response to CartRune's scanner contract.
"""

import base64
import json
import logging
import os
import re
from typing import Any

import requests
from PIL import Image
from dotenv import load_dotenv

logger = logging.getLogger("cartrune.qwen")

load_dotenv()

VISION_PROVIDER = os.getenv("VISION_PROVIDER", "ollama").strip().lower()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b")
VLLM_BASE_URL = os.getenv("VLLM_BASE_URL", "http://localhost:8000/v1").rstrip("/")
VLLM_MODEL = os.getenv("VLLM_MODEL", "Qwen/Qwen2-VL-2B-Instruct-AWQ")
VLLM_API_KEY = os.getenv("VLLM_API_KEY", "").strip()
VLLM_TIMEOUT = float(os.getenv("VLLM_TIMEOUT", "120"))
VLLM_ENABLED = os.getenv("VLLM_ENABLED", "1").lower() not in {"0", "false", "no"}
VLLM_MAX_TOKENS = int(os.getenv("VLLM_MAX_TOKENS", "96"))


def _parse_json(text: str) -> dict[str, Any]:
    cleaned = re.sub(r"```(?:json)?", "", text, flags=re.IGNORECASE).replace("```", "").strip()
    start = cleaned.find("{")
    if start < 0:
        raise ValueError("Qwen2-VL returned no JSON object")
    value, _ = json.JSONDecoder().raw_decode(cleaned[start:])
    if not isinstance(value, dict):
        raise ValueError("Qwen2-VL returned a non-object JSON value")
    return value


def _image_data_url(image: Image.Image) -> str:
    """Encode the in-memory image for the vLLM OpenAI-compatible API."""
    from io import BytesIO

    buffer = BytesIO()
    image.convert("RGB").save(buffer, format="JPEG", quality=88, optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def _prompt() -> str:
    return (
        "Analyze this physical video game cover. Extract only visible or strongly "
        "supported information. Return JSON only with exactly these string fields: "
        "title, console, region, edition, publisher. Use an empty string when unknown. "
        "Do not guess a title from generic artwork. Keep the original spelling when readable."
    )


def _analyze_ollama(image: Image.Image) -> dict[str, Any]:
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [{
            "role": "user",
            "content": _prompt(),
            "images": [_image_data_url(image).split(",", 1)[1]],
        }],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0, "num_predict": VLLM_MAX_TOKENS},
    }
    response = requests.post(
        f"{OLLAMA_BASE_URL}/api/chat",
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=VLLM_TIMEOUT,
    )
    response.raise_for_status()
    body = response.json()
    return _parse_json(str(body["message"]["content"]))


def _analyze_vllm(image: Image.Image) -> dict[str, Any]:
    prompt = (
        "Analyze this physical video game cover. Extract only visible or strongly "
        "supported information. Return JSON only with exactly these string fields: "
        "title, console, region, edition, publisher. Use an empty string when unknown. "
        "Do not guess a title from generic artwork."
    )
    payload = {
        "model": VLLM_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": _image_data_url(image)}},
                    {"type": "text", "text": prompt},
                ],
            }
        ],
        "temperature": 0,
        "max_tokens": VLLM_MAX_TOKENS,
    }
    response = requests.post(
        f"{VLLM_BASE_URL}/chat/completions",
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=VLLM_TIMEOUT,
    )
    response.raise_for_status()
    body = response.json()
    text = body["choices"][0]["message"]["content"]
    if isinstance(text, list):
        text = "".join(part.get("text", "") for part in text if isinstance(part, dict))
    return _parse_json(str(text))


def analyze_cover(image: Image.Image) -> dict[str, Any]:
    if VISION_PROVIDER in {"", "disabled", "none", "off"}:
        raise RuntimeError("vision cover analysis is disabled")
    try:
        raw = _analyze_ollama(image) if VISION_PROVIDER == "ollama" else _analyze_vllm(image)
    except requests.RequestException as exc:
        provider = "Ollama" if VISION_PROVIDER == "ollama" else "vLLM"
        raise RuntimeError(f"{provider} request failed: {exc}") from exc
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise RuntimeError(f"invalid {VISION_PROVIDER} response: {exc}") from exc

    fields = ("title", "console", "region", "edition", "publisher")
    return {field: str(raw.get(field) or "").strip() for field in fields}
