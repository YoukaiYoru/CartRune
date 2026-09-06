import { create } from 'zustand';
import { tokenStorage } from '@/services/auth';
import { api } from '@/services/api';

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
    } catch {
      await tokenStorage.clearTokens();
      set({ user: null, isAuthenticated: false });
    }
  }

  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,

    login: async (email, password) => {
      const { data } = await api.post('/auth/login', { email, password });
      const { access_token, refresh_token } = data.data;
      await tokenStorage.setTokens(access_token, refresh_token);
      await fetchUser();
    },

    register: async (username, email, password) => {
      const { data } = await api.post('/auth/register', { username, email, password });
      const { access_token, refresh_token } = data.data;
      await tokenStorage.setTokens(access_token, refresh_token);
      await fetchUser();
    },

    logout: async () => {
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
        await fetchUser();
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