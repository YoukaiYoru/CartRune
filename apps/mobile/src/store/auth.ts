import { create } from 'zustand';
import axios from 'axios';
import { tokenStorage } from '@/services/auth';
import { api } from '@/services/api';
import { loginSchema, registerPayloadSchema } from '@/lib/auth-validation';

interface User {
  id: string;
  username: string;
  email: string;
  avatar_url: string;
  bio: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  setTokens: (access: string, refresh: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  async function fetchUser() {
    try {
      const { data } = await api.get('/me');
      set({ user: data.data, isAuthenticated: true });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status !== 401) {
        // A temporary Azure/API outage must not destroy a valid local session.
        throw error;
      }
      await tokenStorage.clearTokens();
      set({ user: null, isAuthenticated: false });
    }
  }

  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,

    login: async (email, password) => {
      const payload = loginSchema.parse({ email, password });
      const { data } = await api.post('/auth/login', payload);
      const { access_token, refresh_token } = data.data;
      await tokenStorage.setTokens(access_token, refresh_token);
      await fetchUser();
    },

    register: async (username, email, password) => {
      const payload = registerPayloadSchema.parse({ username, email, password });
      const { data } = await api.post('/auth/register', payload);
      const { access_token, refresh_token } = data.data;
      await tokenStorage.setTokens(access_token, refresh_token);
      await fetchUser();
    },

		logout: async () => {
			const refreshToken = await tokenStorage.getRefreshToken();
			try {
				await api.post('/auth/logout', { refresh_token: refreshToken });
			} catch {
				// Local cleanup must still happen if the network is unavailable.
			}
			await tokenStorage.clearTokens();
      set({ user: null, isAuthenticated: false });
    },

    loadUser: async () => {
      try {
        const token = await tokenStorage.getAccessToken();
        if (!token) {
          set({ isLoading: false });
          return;
        }
        set({ isAuthenticated: true });
        try {
          await fetchUser();
        } catch {
          // Keep the session while the API is temporarily unavailable.
          set({ isLoading: false });
          return;
        }
        set({ isLoading: false });
      } catch {
        await tokenStorage.clearTokens();
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    },

    setTokens: async (access, refresh) => {
      await tokenStorage.setTokens(access, refresh);
      set({ isAuthenticated: true });
    },
  };
});
