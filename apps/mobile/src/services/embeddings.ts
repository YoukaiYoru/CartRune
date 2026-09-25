import { api } from '@/services/api';
import type { CoverAnalysis } from '@/services/types';

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
  console.info('[scanner] cover analysis started: visual match');
  const form = new FormData();
  form.append('image', {
    uri,
    name: 'cover.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const { data } = await api.post<EmbedResponse>('/scanner/embed', form, {
    timeout: 120000,
    signal: withTimeout(120000),
  });
  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error('empty embedding response');
  }
  console.info(`[scanner] cover analysis finished: visual match (${data.embedding.length} dimensions)`);
  return data.embedding;
}

// OCR server-side (EasyOCR). Works from Expo Go, where native modules like
// expo-mlkit-ocr are not available: the photo is uploaded to the embeddings
// service and the recognized text line is returned.
export async function ocrPhoto(uri: string): Promise<string | null> {
  console.info('[scanner] cover analysis started: OCR');
  const form = new FormData();
  form.append('image', {
    uri,
    name: 'cover.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const { data } = await api.post<{ text?: string }>('/scanner/ocr', form, {
    timeout: 30000,
    signal: withTimeout(30000),
  });
  const text = data.text ?? '';
  console.info(`[scanner] cover analysis finished: OCR (${text ? 'text found' : 'no text'})`);
  return text;
}

export async function analyzeCover(uri: string): Promise<CoverAnalysis> {
  console.info('[scanner] cover analysis started: vision metadata');
  const form = new FormData();
  form.append('image', { uri, name: 'cover.jpg', type: 'image/jpeg' } as unknown as Blob);
  const { data } = await api.post<CoverAnalysis>('/scanner/analyze', form, {
    // La primera inferencia de Qwen puede tardar en CPU.
    timeout: 180000,
    signal: withTimeout(180000),
  });
  if (!data || typeof data.title !== 'string') throw new Error('invalid cover analysis response');
  console.info(`[scanner] cover analysis finished: vision (${data.title || 'no title'})`);
  return data;
}
