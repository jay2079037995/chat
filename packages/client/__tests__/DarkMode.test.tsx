import { useThemeStore } from '../src/modules/chat/stores/useThemeStore';

describe('useThemeStore - Dark Mode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    // 重置 store
    useThemeStore.setState({ mode: 'system', isDark: false });
  });

  it('initializes with system mode by default', () => {
    const { mode, isDark } = useThemeStore.getState();
    expect(mode).toBe('system');
    expect(isDark).toBe(false); // matchMedia mock returns false
  });

  it('setMode to dark updates state and DOM', () => {
    useThemeStore.getState().setMode('dark');
    const { mode, isDark } = useThemeStore.getState();
    expect(mode).toBe('dark');
    expect(isDark).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('theme_mode')).toBe('dark');
  });

  it('setMode to light updates state and DOM', () => {
    useThemeStore.getState().setMode('dark');
    useThemeStore.getState().setMode('light');
    const { mode, isDark } = useThemeStore.getState();
    expect(mode).toBe('light');
    expect(isDark).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('theme_mode')).toBe('light');
  });

  it('initTheme reads from localStorage', () => {
    localStorage.setItem('theme_mode', 'dark');
    useThemeStore.getState().initTheme();
    const { mode, isDark } = useThemeStore.getState();
    expect(mode).toBe('dark');
    expect(isDark).toBe(true);
  });

  it('initTheme defaults to system when no saved preference', () => {
    useThemeStore.getState().initTheme();
    const { mode } = useThemeStore.getState();
    expect(mode).toBe('system');
  });
});
