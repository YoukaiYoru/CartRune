# Motor OCR server-side para CartRune.
#
# Usa EasyOCR (detección + reconocimiento de texto) sobre la foto de la
# portada. Al correr en el servidor, el OCR funciona desde Expo Go: el
# telefono solo sube la imagen y recibe el texto detectado (no hace falta
# modulo nativo en el dispositivo).

import numpy as np
import easyocr

_SUPPORTED_LANGS = ["en", "es", "fr", "de", "it", "pt"]


class OcrEngine:
    def __init__(self, langs=None):
        langs = langs or _SUPPORTED_LANGS
        # Uses easyocr's default model dir (~/.EasyOCR/model).
        self.reader = easyocr.Reader(langs, gpu=False, verbose=False)

    def read_text(self, image):
        """Devuelve la primera linea legible encontrada en la imagen, o ''."""
        arr = np.asarray(image)[:, :, :3]
        results = self.reader.readtext(arr, detail=1, paragraph=False)
        lines = []
        for bbox, text, conf in results:
            t = " ".join(text.strip().split())
            if t:
                lines.append((conf, t))
        if not lines:
            return ""
        # Ordena por confianza, luego por posicion en la imagen (arriba primero).
        lines.sort(key=lambda x: (-x[0]))
        return lines[0][1]