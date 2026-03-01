import { create } from 'zustand';
import type { User } from '@chat/shared';
import { authService } from '../services/authService';

interface AuthState {
  user: User | null;
  token: string | null;
  sessionId: string | null;
  loading: boolean;
  initialized: boolean;

  register: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  sessionId: null,
  loading: false,
  initialized: false,

  register: async (username: string, password: string) => {
    const result = await authService.register(username, password);
    localStorage.setItem('token', result.token);
    sessionStorage.setItem('sessionId', result.sessionId);
    set({ user: result.user, token: result.token, sessionId: result.sessionId });
  },

  login: async (username: string, password: string) => {
    const result = await authService.login(username, password);
    localStorage.setItem('token', result.token);
    sessionStorage.setItem('sessionId', result.sessionId);
    set({ user: result.user, token: result.token, sessionId: result.sessionId });
  },

  logout: async () => {
    try {
      await authService.logout();
    } catch {
      // ignore logout errors
    }
    localStorage.removeItem('token');
    sessionStorage.removeItem('sessionId');
    set({ user: null, token: null, sessionId: null });
  },

  initAuth: async () => {
    const { initialized } = get();
    if (initialized) return;

    set({ loading: true });

    // Try session first
    const sessionId = sessionStorage.getItem('sessionId');
    if (sessionId) {
      try {
        const { user } = await authService.getMe();
        set({ user, sessionId, token: localStorage.getItem('token'), loading: false, initialized: true });
        return;
      } catch {
        sessionStorage.removeItem('sessionId');
      }
    }

    // Try token auto-login
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const result = await authService.createSession(token);
        sessionStorage.setItem('sessionId', result.sessionId);
        set({ user: result.user, token, sessionId: result.sessionId, loading: false, initialized: true });
        return;
      } catch {
        localStorage.removeItem('token');
      }
    }

    set({ loading: false, initialized: true });
  },
}));
