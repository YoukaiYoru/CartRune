import { AppState } from 'react-native';
import { focusManager, QueryClient } from '@tanstack/react-query';

focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state) => {
    handleFocus(state === 'active');
  });
  return () => subscription.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const qk = {
  games: (page: number) => ['games', page] as const,
  game: (id: string) => ['game', id] as const,
  reviews: (gameId: string) => ['reviews', gameId] as const,
  libraries: () => ['libraries'] as const,
  library: (id: string) => ['library', id] as const,
  profile: (username: string) => ['profile', username] as const,
  feed: (page: number) => ['feed', page] as const,
};
