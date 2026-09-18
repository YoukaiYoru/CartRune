import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'cartrune_access_token';
const REFRESH_KEY = 'cartrune_refresh_token';

export const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    return getItem(TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    return getItem(REFRESH_KEY);
  },

  async setTokens(access: string, refresh: string): Promise<void> {
    await Promise.all([setItem(TOKEN_KEY, access), setItem(REFRESH_KEY, refresh)]);
  },

  async clearTokens(): Promise<void> {
    await Promise.all([deleteItem(TOKEN_KEY), deleteItem(REFRESH_KEY)]);
  },
};

function isWebStorageAvailable() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.localStorage;
}

async function getItem(key: string) {
  if (isWebStorageAvailable()) return window.localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string) {
  if (isWebStorageAvailable()) {
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string) {
  if (isWebStorageAvailable()) {
    window.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
