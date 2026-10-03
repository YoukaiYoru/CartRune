import { api } from '@/services/api';
import type { ScanResponse } from '@/services/types';

function cleanText(value: string): string {
  const text = value.trim();
  if (!text || text.length > 120) throw new Error('Scan text is invalid');
  return text;
}

function unwrap<T>(data: { data: T }): T {
  return data.data;
}

export async function scanText(text: string, platformHint?: string): Promise<ScanResponse> {
  const { data } = await api.post('/scanner/text', { text: cleanText(text), platform_hint: platformHint?.slice(0, 64) });
  return unwrap<ScanResponse>(data);
}
