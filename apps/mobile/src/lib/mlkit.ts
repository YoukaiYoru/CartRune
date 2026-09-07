import { NativeModules } from 'react-native';

interface OcrResponse {
  text: string;
}

let cached: ((uri: string) => Promise<OcrResponse>) | null | undefined;

function getOcr(): ((uri: string) => Promise<OcrResponse>) | null {
  if (cached !== undefined) return cached;
  // Native module check first: never throws, so this is safe to call during
  // render even in Expo Go where expo-mlkit-ocr is not bundled.
  if (NativeModules.ExpoMlkitOcr === undefined) {
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
  return getOcr() !== null;
}

export async function recognizeTextSafe(uri: string): Promise<string | null> {
  const fn = getOcr();
  if (!fn) return null;
  try {
    const result = await fn(uri);
    return result.text ?? '';
  } catch {
    return null;
  }
}