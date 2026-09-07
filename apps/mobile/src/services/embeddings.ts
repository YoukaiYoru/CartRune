import { Platform } from 'react-native';

const FALLBACK_HOST = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
const HOST = process.env.EXPO_PUBLIC_API_HOST || FALLBACK_HOST;
export const EMBEDDINGS_BASE = `http://${HOST}:8700`;

interface EmbedResponse {
  embedding: number[];
}

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  // Cannot clearTimeout reliably on abort without keeping the timer around;
  // a late abort after success is a no-op for the already-resolved fetch.
  return controller.signal;
}

export async function embedPhoto(uri: string): Promise<number[]> {
  const form = new FormData();
  form.append('image', {
    uri,
    name: 'cover.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const resp = await fetch(`${EMBEDDINGS_BASE}/embed`, {
    method: 'POST',
    body: form,
    // Do NOT set Content-Type manually: React Native must generate the
    // multipart boundary itself, otherwise FastAPI cannot parse the upload.
    signal: withTimeout(20000),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`embedding failed (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as EmbedResponse;
  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error('empty embedding response');
  }
  return data.embedding;
}

// OCR server-side (EasyOCR). Works from Expo Go, where native modules like
// expo-mlkit-ocr are not available: the photo is uploaded to the embeddings
// service and the recognized text line is returned.
export async function ocrPhoto(uri: string): Promise<string | null> {
  const form = new FormData();
  form.append('image', {
    uri,
    name: 'cover.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const resp = await fetch(`${EMBEDDINGS_BASE}/ocr`, {
    method: 'POST',
    body: form,
    signal: withTimeout(30000),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ocr failed (${resp.status}): ${text}`);
  }

  const data = (await resp.json()) as { text?: string };
  return data.text ?? '';
}