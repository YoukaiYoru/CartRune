import Constants from 'expo-constants';
import { ocrPhoto } from '@/services/embeddings';

interface OcrResponse {
  text: string;
}

// expo-mlkit-ocr ships a native module, so it can never work inside the Expo
// Go client. Detect it deterministically before ever requiring the module: a
// bare require() of a missing native module throws in a way that still trips
// the LogBox error boundary even when wrapped in try/catch.
function isExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

let cached: ((uri: string) => Promise<OcrResponse>) | null | undefined;

function getOcr(): ((uri: string) => Promise<OcrResponse>) | null {
  if (cached !== undefined) return cached;
  if (isExpoGo()) {
    cached = null;
    return cached;
  }
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
  // Native mlkit (dev/prod builds) OR remote EasyOCR via the embeddings
  // service, which is what Expo Go relies on.
  return getOcr() !== null || isExpoGo();
}

export async function recognizeTextSafe(uri: string): Promise<string | null> {
  const fn = getOcr();
  if (fn) {
    try {
      const result = await fn(uri);
      return result.text ?? '';
    } catch {
      return null;
    }
  }
  // Expo Go: fall back to the server-side EasyOCR endpoint.
  try {
    return await ocrPhoto(uri);
  } catch {
    return null;
  }
}