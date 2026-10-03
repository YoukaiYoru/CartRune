import { Platform } from 'react-native';
import axios from 'axios';
import { tokenStorage } from '@/services/auth';

const FALLBACK_HOST = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
const configuredHost = process.env.EXPO_PUBLIC_API_HOST?.trim();
if (!configuredHost && process.env.NODE_ENV === 'production') {
  throw new Error('EXPO_PUBLIC_API_HOST must be configured for production builds');
}
const API_HOST = configuredHost || FALLBACK_HOST;
const API_ROOT = /^https?:\/\//i.test(API_HOST)
  ? API_HOST.replace(/\/+$/, '')
  : `http://${API_HOST}:8080`;
if (process.env.NODE_ENV === 'production' && !API_ROOT.startsWith('https://')) {
  throw new Error('Production API must use HTTPS');
}
export const API_BASE = `${API_ROOT}/api/v1`;

/** Resolve API-relative media paths before native image/video components use them. */
export function resolveApiUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${API_BASE.replace(/\/api\/v1$/, '')}${path}`;
}

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(`${API_BASE}/auth/refresh`, { refresh_token: refreshToken })
      .then(async ({ data }) => {
        const newToken = data.data.access_token;
        const newRefresh = data.data.refresh_token;
        if (typeof newToken !== 'string' || typeof newRefresh !== 'string') return null;
        await tokenStorage.setTokens(newToken, newRefresh);
        return newToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Axios/React Native must generate the multipart boundary itself. A fixed
  // Content-Type without that boundary makes FastAPI reject Expo Go photos.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = await tokenStorage.getRefreshToken();
      if (refreshToken) {
        const newToken = await refreshAccessToken(refreshToken);
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      }
      await tokenStorage.clearTokens();
    }
    return Promise.reject(error);
  }
);
