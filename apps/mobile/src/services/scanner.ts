import { api } from '@/services/api';
import type { ScanResponse } from '@/services/types';

function unwrap<T>(data: { data: T }): T {
  return data.data;
}

export async function scanBarcode(barcode: string): Promise<ScanResponse> {
  const { data } = await api.post('/scanner/barcode', { barcode });
  return unwrap<ScanResponse>(data);
}

export async function scanText(text: string, platformHint?: string): Promise<ScanResponse> {
  const { data } = await api.post('/scanner/text', { text, platform_hint: platformHint });
  return unwrap<ScanResponse>(data);
}

export async function matchEmbedding(
  embedding: number[],
  platformHint?: string
): Promise<ScanResponse> {
  const { data } = await api.post('/scanner/match', {
    embedding,
    platform_hint: platformHint,
  });
  return unwrap<ScanResponse>(data);
}