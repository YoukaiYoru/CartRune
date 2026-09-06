import { api } from '@/services/api';
import type { Comment } from '@/services/types';

function unwrap<T>(data: { data: T }): T {
  return data.data;
}

export async function getComments(reviewId: string): Promise<Comment[]> {
  const { data } = await api.get(`/reviews/${reviewId}/comments`);
  return unwrap<Comment[]>(data);
}

export async function addComment(reviewId: string, content: string): Promise<Comment> {
  const { data } = await api.post(`/reviews/${reviewId}/comments`, { content });
  return unwrap<Comment>(data);
}