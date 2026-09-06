import { api } from '@/services/api';
import type {
  ImportResponse,
  ScreenScraperDetail,
  SearchItem,
} from '@/services/types';

function unwrap<T>(data: { data: T }): T {
  return data.data;
}

export interface ScreenScraperSearchInput {
  query: string;
  systemeid?: number;
  region?: string;
  language?: string;
}

export async function searchScreenScraper(
  input: ScreenScraperSearchInput
): Promise<SearchItem[]> {
  const { data } = await api.post('/screenscraper/search', input);
  return unwrap<SearchItem[]>(data);
}

export async function getScreenScraperGame(
  ssId: string,
  region?: string,
  language?: string
): Promise<ScreenScraperDetail> {
  const { data } = await api.get(`/screenscraper/games/${ssId}`, {
    params: { region, language },
  });
  return unwrap<ScreenScraperDetail>(data);
}

export async function importScreenScraperGame(
  ssId: string,
  region?: string,
  language?: string
): Promise<ImportResponse> {
  const { data } = await api.post(`/screenscraper/games/${ssId}/import`, null, {
    params: { region, language },
  });
  return unwrap<ImportResponse>(data);
}