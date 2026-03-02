/**
 * 主题状态管理 (Zustand Store)
 *
 * 管理暗色模式切换，支持 light/dark/system 三种模式。
 * 偏好持久化到 localStorage，system 模式跟随系统设置。
 */
import { create } from 'zustand';

/** 主题模式 */
type ThemeMode = 'light' | 'dark' | 'system';

/** localStorage 键名 */
const STORAGE_KEY = 'theme_mode';

interface ThemeState {
  /** 用户选择的主题模式 */
  mode: ThemeMode;
  /** 实际是否为暗色（system 模式下由系统决定） */
  isDark: boolean;

  /** 切换主题模式 */
  setMode: (mode: ThemeMode) => void;
  /** 初始化主题（读取 localStorage + 监听系统偏好） */
  initTheme: () => void;
}

/** 判断系统是否为暗色模式 */
function getSystemDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** 将 data-theme 属性应用到 document */
function applyTheme(isDark: boolean): void {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  isDark: false,

  setMode: (mode: ThemeMode) => {
    const isDark = mode === 'system' ? getSystemDark() : mode === 'dark';
    localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(isDark);
    set({ mode, isDark });
  },

  initTheme: () => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const mode = saved || 'system';
    const isDark = mode === 'system' ? getSystemDark() : mode === 'dark';

    applyTheme(isDark);
    set({ mode, isDark });

    // 监听系统主题变化（仅 system 模式生效）
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      const { mode: currentMode } = get();
      if (currentMode === 'system') {
        applyTheme(e.matches);
        set({ isDark: e.matches });
      }
    });
  },
}));
