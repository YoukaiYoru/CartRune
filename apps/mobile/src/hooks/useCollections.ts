import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-client';
import * as collectionsApi from '@/services/collections';
import * as gamesApi from '@/services/games';
import type { Progress } from '@/services/types';

export function useLibraries() {
  return useQuery({
    queryKey: qk.libraries(),
    queryFn: () => collectionsApi.getLibraries(),
  });
}

export function usePrimaryLibrary() {
  const query = useLibraries();
  const library = query.data?.[0];
  return {
    ...query,
    library,
  };
}

export function useCreateLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: collectionsApi.CreateLibraryInput) =>
      collectionsApi.createLibrary(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.libraries() });
    },
  });
}

export function useLibrary(id: string) {
  return useQuery({
    queryKey: qk.library(id),
    queryFn: () => collectionsApi.getLibrary(id),
    enabled: !!id,
  });
}

export function useAddGameToLibrary(libraryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: collectionsApi.AddGameInput) =>
      collectionsApi.addGameToLibrary(libraryId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.library(libraryId) });
    },
  });
}

export function useRemoveGameFromLibrary(libraryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (gameId: string) =>
      collectionsApi.removeGameFromLibrary(libraryId, gameId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.library(libraryId) });
    },
  });
}

export function useStartGame(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => gamesApi.startGame(gameId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });
}

export function useCompleteGame(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => gamesApi.completeGame(gameId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.game(gameId) });
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });
}

export function useUpdateProgress(gameId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Progress>) =>
      gamesApi.updateProgress(gameId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.game(gameId) });
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });
}