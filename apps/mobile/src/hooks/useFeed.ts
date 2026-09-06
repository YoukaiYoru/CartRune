import { useQuery } from '@tanstack/react-query';
import { qk } from '@/lib/query-client';
import * as feedApi from '@/services/feed';

export function useFeed(page = 1) {
  return useQuery({
    queryKey: qk.feed(page),
    queryFn: () => feedApi.getFeed(page),
  });
}