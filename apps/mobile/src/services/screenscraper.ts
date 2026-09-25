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
  const { data } = await api.post('/catalog/search', input);
  const items = unwrap<Array<Record<string, unknown>>>(data);
  return items.map((item) => ({
    ...item,
    game_id: String(item.game_id ?? ''),
    title: String(item.title ?? ''),
    system: item.system ? String(item.system) : undefined,
    system_id: item.system_id == null ? undefined : Number(item.system_id),
    region: item.region ? String(item.region) : undefined,
    release_date: item.release_date ? String(item.release_date) : undefined,
    cover_url: item.cover_url ? String(item.cover_url) : undefined,
    synopsis: item.synopsis ? String(item.synopsis) : undefined,
    note: item.note == null ? undefined : String(item.note),
    official: Boolean(item.official),
    filtered_out: item.filtered_out && String(item.filtered_out) !== 'false' ? true : undefined,
  })) as SearchItem[];
}

export async function getScreenScraperGame(
  ssId: string,
  region?: string,
  language?: string
): Promise<ScreenScraperDetail> {
  const { data } = await api.get(`/catalog/games/${ssId}`, {
    params: { region, language },
  });
  const item = unwrap<Record<string, unknown>>(data);
  return {
    ...item,
    game_id: String(item.game_id ?? ''),
    title: String(item.title ?? ''),
    description: String(item.description ?? ''),
    developer: String(item.developer ?? ''),
    publisher: String(item.publisher ?? ''),
    release_date: item.release_date ? String(item.release_date) : undefined,
    players: item.players == null ? undefined : String(item.players),
    note: item.note == null ? undefined : String(item.note),
    system: item.system ? String(item.system) : undefined,
    system_id: item.system_id == null ? undefined : Number(item.system_id),
    official: Boolean(item.official),
    filtered_out: item.filtered_out && String(item.filtered_out) !== 'false' ? true : undefined,
    cover_url: item.cover_url ? String(item.cover_url) : undefined,
    covers: Array.isArray(item.covers) ? item.covers : [],
    media: Array.isArray(item.media) ? item.media : [],
  } as ScreenScraperDetail;
}

export async function importScreenScraperGame(
  ssId: string,
  region?: string,
  language?: string
): Promise<ImportResponse> {
  const { data } = await api.post(`/catalog/games/${ssId}/import`, null, {
    params: { region, language },
  });
  return unwrap<ImportResponse>(data);
}
