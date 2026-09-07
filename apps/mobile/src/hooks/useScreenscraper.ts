import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ScreenScraperDetail } from '@/services/types';
import * as ssApi from '@/services/screenscraper';

export function useScreenScraperSearch(query: string | null, enabled = false) {
  return useQuery({
    queryKey: ['screenscraper', 'search', query],
    queryFn: () => ssApi.searchScreenScraper({ query: query as string }),
    enabled: enabled && !!query,
    retry: 1,
  });
}

export function useImportScreenScraperGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ssId: string) => ssApi.importScreenScraperGame(ssId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });
}

// Resolves a game title to its full ScreenScraper media (covers, screenshots,
// logos, videos) by searching the remote database, picking the first result,
// then fetching its detail.
export function useScreenScraperMediaForTitle(title: string | null, enabled = false) {
  return useQuery({
    queryKey: ['screenscraper', 'media', title],
    queryFn: async () => {
      if (!title) return null;
      const results = await ssApi.searchScreenScraper({ query: title });
      const best = results.find((r) => r.game_id) || results[0];
      if (!best) return null;
      const detail = await ssApi.getScreenScraperGame(best.game_id);
      return detail;
    },
    enabled: enabled && !!title,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
}