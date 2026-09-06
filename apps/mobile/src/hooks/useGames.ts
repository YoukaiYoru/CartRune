import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-client';
import * as gamesApi from '@/services/games';
import type { CreateReviewInput } from '@/services/games';

export function useGames(page = 1) {
  return useQuery({
    queryKey: qk.games(page),
    queryFn: () => gamesApi.getGames(page),
  });
}

export function useSearchGames(query: string, limit = 20) {
  return useQuery({
    queryKey: ['games', 'search', query] as const,
    queryFn: () => gamesApi.searchGames(query, 1, limit),
    enabled: query.trim().length > 0,
  });
}

export function useGame(id: string) {
  return useQuery({
    queryKey: qk.game(id),
    queryFn: () => gamesApi.getGame(id),
    enabled: !!id,
  });
}

export function useGameReviews(gameId: string) {
  return useQuery({
    queryKey: qk.reviews(gameId),
    queryFn: () => gamesApi.getGameReviews(gameId),
    enabled: !!gameId,
  });
}

export function useCreateReview(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateReviewInput, 'game_id'>) =>
      gamesApi.createReview(gameId, { ...input, game_id: gameId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.reviews(gameId) });
    },
  });
}

export function useUpdateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string } & Partial<CreateReviewInput>) =>
      gamesApi.updateReview(input.id, input),
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gamesApi.deleteReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}

export function useLikeReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gamesApi.likeReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}

export function useUnlikeReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gamesApi.unlikeReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}