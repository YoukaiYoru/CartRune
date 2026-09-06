import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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