import { api } from '@/services/api';
import type { ScanResponse } from '@/services/types';

function cleanBarcode(value: string): string {
  const barcode = value.trim();
  if (barcode.length > 32) throw new Error('Barcode is too long');
  return barcode;
}

function cleanText(value: string): string {
  const text = value.trim();
  if (!text || text.length > 120) throw new Error('Scan text is invalid');
  return text;
}

function cleanEmbedding(embedding: number[]): number[] {
  if (embedding.length !== 512 || embedding.some((value) => !Number.isFinite(value) || Math.abs(value) > 10)) {
    throw new Error('Embedding is invalid');
  }
  return embedding;
}

function unwrap<T>(data: { data: T }): T {
  return data.data;
}

export async function scanBarcode(barcode: string): Promise<ScanResponse> {
  const { data } = await api.post('/scanner/barcode', { barcode: cleanBarcode(barcode) });
  return unwrap<ScanResponse>(data);
}

export async function scanText(text: string, platformHint?: string): Promise<ScanResponse> {
  const { data } = await api.post('/scanner/text', { text: cleanText(text), platform_hint: platformHint?.slice(0, 64) });
  return unwrap<ScanResponse>(data);
}

export async function matchEmbedding(
  embedding: number[],
  platformHint?: string
): Promise<ScanResponse> {
  const { data } = await api.post('/scanner/match', {
    embedding: cleanEmbedding(embedding),
    platform_hint: platformHint?.slice(0, 64),
  });
  return unwrap<ScanResponse>(data);
}
