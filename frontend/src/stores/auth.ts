import { create } from 'zustand';
import { apiClient } from './api';

interface AuthStore {
  token: string | null;
  user: { id: string; email: string; name: string } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  initializeFromStorage: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.login(email, password);
      set({
        token: response.token,
        user: response.user,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Login failed',
        isLoading: false
      });
      throw error;
    }
  },

  register: async (email: string, password: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.register(email, password, name);
      set({
        token: response.token,
        user: response.user,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Registration failed',
        isLoading: false
      });
      throw error;
    }
  },

  logout: () => {
    apiClient.logout();
    set({ token: null, user: null, isAuthenticated: false });
  },

  clearError: () => set({ error: null }),

  initializeFromStorage: () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      apiClient.setToken(token);
      set({ token, isAuthenticated: true });
    }
  }
}));
