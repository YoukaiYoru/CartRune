import { api } from '@/services/api';
import type {
  Cover,
  Game,
  GameDetail,
  PaginatedGames,
  PaginatedReviews,
  Progress,
  Release,
  Review,
} from '@/services/types';

function unwrap<T>(data: { data: T }): T {
  return data.data;
}

export async function getGames(page = 1, limit = 20): Promise<PaginatedGames> {
  const { data } = await api.get('/games', { params: { page, limit } });
  return unwrap<PaginatedGames>(data);
}

export async function searchGames(q: string, page = 1, limit = 20): Promise<PaginatedGames> {
  const { data } = await api.get('/games/search', { params: { q, page, limit } });
  return unwrap<PaginatedGames>(data);
}

export async function getGame(id: string): Promise<GameDetail> {
  const { data } = await api.get(`/games/${id}`);
  return unwrap<GameDetail>(data);
}

export async function getGameReleases(id: string): Promise<Release[]> {
  const { data } = await api.get(`/games/${id}/releases`);
  return unwrap<Release[]>(data);
}

export async function getGameCovers(id: string): Promise<Cover[]> {
  const { data } = await api.get(`/games/${id}/covers`);
  return unwrap<Cover[]>(data);
}

export interface CreateReviewInput {
  game_id: string;
  rating: number;
  title?: string;
  content?: string;
  spoiler?: boolean;
}

export async function getGameReviews(
  gameId: string,
  page = 1,
  limit = 20
): Promise<PaginatedReviews> {
  const { data } = await api.get(`/games/${gameId}/reviews`, { params: { page, limit } });
  return unwrap<PaginatedReviews>(data);
}

export async function createReview(gameId: string, input: CreateReviewInput): Promise<Review> {
  const { data } = await api.post(`/games/${gameId}/reviews`, input);
  return unwrap<Review>(data);
}

export async function updateReview(
  id: string,
  input: Partial<Omit<CreateReviewInput, 'game_id'>>
): Promise<Review> {
  const { data } = await api.patch(`/reviews/${id}`, input);
  return unwrap<Review>(data);
}

export async function deleteReview(id: string): Promise<void> {
  await api.delete(`/reviews/${id}`);
}

export async function likeReview(id: string): Promise<void> {
  await api.post(`/reviews/${id}/like`);
}

export async function unlikeReview(id: string): Promise<void> {
  await api.delete(`/reviews/${id}/like`);
}

export async function updateProgress(
  gameId: string,
  input: Partial<Progress>
): Promise<Progress> {
  const { data } = await api.patch(`/games/${gameId}/progress`, input);
  return unwrap<Progress>(data);
}

export async function startGame(gameId: string): Promise<Progress> {
  const { data } = await api.post(`/games/${gameId}/start`);
  return unwrap<Progress>(data);
}

export async function completeGame(gameId: string): Promise<Progress> {
  const { data } = await api.post(`/games/${gameId}/complete`);
  return unwrap<Progress>(data);
}