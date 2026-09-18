import { api } from '@/services/api';
import type { Library, LibraryDetail } from '@/services/types';

function unwrap<T>(data: { data: T }): T {
  return data.data;
}

export interface CreateLibraryInput {
  name: string;
  description?: string;
  is_public?: boolean;
}

export interface AddGameInput {
  game_id: string;
  release_id?: string;
  status?: string;
}

export async function getLibraries(): Promise<Library[]> {
  const { data } = await api.get('/libraries');
  return unwrap<Library[]>(data);
}

export async function createLibrary(input: CreateLibraryInput): Promise<Library> {
  const { data } = await api.post('/libraries', input);
  return unwrap<Library>(data);
}

export async function getLibrary(id: string): Promise<LibraryDetail> {
  const { data } = await api.get(`/libraries/${id}`);
  return unwrap<LibraryDetail>(data);
}

export async function getPublicLibrary(id: string): Promise<LibraryDetail> {
	const { data } = await api.get(`/public/libraries/${id}`);
	return unwrap<LibraryDetail>(data);
}

export async function updateLibrary(
  id: string,
  input: Partial<CreateLibraryInput>
): Promise<Library> {
  const { data } = await api.patch(`/libraries/${id}`, input);
  return unwrap<Library>(data);
}

export async function deleteLibrary(id: string): Promise<void> {
  await api.delete(`/libraries/${id}`);
}

export async function addGameToLibrary(id: string, input: AddGameInput): Promise<void> {
  await api.post(`/libraries/${id}/games`, input);
}

export async function removeGameFromLibrary(id: string, gameId: string): Promise<void> {
  await api.delete(`/libraries/${id}/games/${gameId}`);
}
