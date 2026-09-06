import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient();

export const qk = {
  games: (page: number) => ['games', page] as const,
  game: (id: string) => ['game', id] as const,
  reviews: (gameId: string) => ['reviews', gameId] as const,
  libraries: () => ['libraries'] as const,
  library: (id: string) => ['library', id] as const,
  profile: (username: string) => ['profile', username] as const,
  feed: (page: number) => ['feed', page] as const,
};