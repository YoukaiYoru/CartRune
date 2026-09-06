import { api } from '@/services/api';
import type { PublicProfile, User } from '@/services/types';

function unwrap<T>(data: { data: T }): T {
  return data.data;
}

export interface UpdateProfileInput {
  username?: string;
  avatar_url?: string;
  bio?: string;
}

export async function getProfile(username: string): Promise<PublicProfile> {
  const { data } = await api.get(`/users/${username}`);
  return unwrap<PublicProfile>(data);
}

export async function updateProfile(input: UpdateProfileInput): Promise<User> {
  const { data } = await api.patch('/users/me', input);
  return unwrap<User>(data);
}

export async function followUser(id: string): Promise<void> {
  await api.post(`/users/${id}/follow`);
}

export async function unfollowUser(id: string): Promise<void> {
  await api.delete(`/users/${id}/follow`);
}