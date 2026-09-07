interface OcrResponse {
  text: string;
}

let cached: ((uri: string) => Promise<OcrResponse>) | null | undefined;

function getOcr(): ((uri: string) => Promise<OcrResponse>) | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-mlkit-ocr');
    cached = mod.recognizeText;
  } catch {
    cached = null;
  }
  return cached as ((uri: string) => Promise<OcrResponse>) | null;
}

export function isOcrAvailable(): boolean {
  return getOcr() !== null;
}

export async function recognizeTextSafe(uri: string): Promise<string | null> {
  const fn = getOcr();
  if (!fn) return null;
  const result = await fn(uri);
  return result.text ?? '';
}