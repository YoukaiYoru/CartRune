import { api } from '@/services/api';
import type { FeedItem } from '@/services/types';

function unwrap<T>(data: { data: T }): T {
  return data.data;
}

export async function getFeed(page = 1, limit = 20): Promise<FeedItem[]> {
  const { data } = await api.get('/feed', { params: { page, limit } });
  return unwrap<FeedItem[]>(data);
}