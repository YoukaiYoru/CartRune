import { api } from '@/services/api';
import type { CoverAnalysis } from '@/services/types';

export async function analyzeCover(uri: string): Promise<CoverAnalysis> {
  const form = new FormData();
  form.append('image', { uri, name: 'cover.jpg', type: 'image/jpeg' } as unknown as Blob);
  const { data } = await api.post<{ data: CoverAnalysis }>('/scanner/analyze', form, {
    timeout: 60000,
  });
  if (!data?.data || typeof data.data.title !== 'string') {
    throw new Error('invalid cover analysis response');
  }
  return data.data;
}
