import { Platform } from 'react-native';
import axios from 'axios';
import { tokenStorage } from '@/services/auth';

const FALLBACK_HOST = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
const HOST = process.env.EXPO_PUBLIC_API_HOST || FALLBACK_HOST;
export const API_BASE = `http://${HOST}:8080/api/v1`;

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

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (refreshToken) {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const newToken = data.data.access_token;
          const newRefresh = data.data.refresh_token;
          await tokenStorage.setTokens(newToken, newRefresh);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch {
        await tokenStorage.clearTokens();
      }
    }
    return Promise.reject(error);
  }
);
