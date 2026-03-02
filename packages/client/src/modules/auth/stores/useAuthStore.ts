/**
 * 认证状态管理 (Zustand Store)
 *
 * 管理用户登录状态、JWT token 和 sessionId，
 * 并提供注册/登录/登出/自动恢复会话等操作。
 */
import { create } from 'zustand';
import type { User } from '@chat/shared';
import { authService } from '../services/authService';
import { cacheService } from '../../../services/cacheService';

/** 认证状态接口 */
interface AuthState {
  /** 当前登录用户（null 表示未登录） */
  user: User | null;
  /** JWT token（持久化到 localStorage） */
  token: string | null;
  /** 当前会话 ID（持久化到 sessionStorage） */
  sessionId: string | null;
  /** 是否正在加载中 */
  loading: boolean;
  /** 是否已完成初始化（防止重复 initAuth） */
  initialized: boolean;

  register: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** 初始化认证状态：先尝试 session 恢复，再尝试 token 自动登录 */
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  sessionId: null,
  loading: false,
  initialized: false,

  /** 注册：调用 API 后将 token/sessionId 持久化并更新状态 */
  register: async (username: string, password: string) => {
    const result = await authService.register(username, password);
    localStorage.setItem('token', result.token);
    sessionStorage.setItem('sessionId', result.sessionId);
    cacheService.saveUserInfo(result.user);
    set({ user: result.user, token: result.token, sessionId: result.sessionId });
  },

  /** 登录：调用 API 后将 token/sessionId 持久化并更新状态 */
  login: async (username: string, password: string) => {
    const result = await authService.login(username, password);
    localStorage.setItem('token', result.token);
    sessionStorage.setItem('sessionId', result.sessionId);
    cacheService.saveUserInfo(result.user);
    set({ user: result.user, token: result.token, sessionId: result.sessionId });
  },

  /** 登出：通知后端 → 清除本地存储 → 重置状态 */
  logout: async () => {
    try {
      await authService.logout();
    } catch {
      // 忽略登出请求的网络错误，本地状态仍需清理
    }
    localStorage.removeItem('token');
    sessionStorage.removeItem('sessionId');
    cacheService.clearAll();
    set({ user: null, token: null, sessionId: null });
  },

  /**
   * 初始化认证状态（仅执行一次）
   * 1. 优先用 sessionId 恢复当前标签页会话
   * 2. 若无 session，则用 localStorage 中的 token 自动登录
   * 3. 两者都无效时保持未登录状态
   */
  initAuth: async () => {
    const { initialized } = get();
    if (initialized) return;

    // 先从缓存恢复用户信息（快速首屏）
    const cachedUser = cacheService.getUserInfo();
    if (cachedUser) {
      set({ user: cachedUser });
    }

    set({ loading: true });

    // 第一步：尝试用 sessionId 恢复会话
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

    // 第二步：尝试用 token 自动登录
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

    // 无有效凭证，标记初始化完成
    set({ loading: false, initialized: true });
  },
}));
