import React, { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AuthGuard from './components/AuthGuard';
import GuestGuard from './components/GuestGuard';
import { modules } from './core/moduleRegistry';
import { useThemeStore } from './modules/chat/stores/useThemeStore';

/** Electron 打包后从 file:// 加载，需用 HashRouter；Web 版使用 BrowserRouter */
const Router = (window as any).electronAPI?.isElectron ? HashRouter : BrowserRouter;

/** Guard 类型到组件的映射 */
const guardMap = {
  auth: AuthGuard,   // 需登录才能访问
  guest: GuestGuard, // 仅未登录可访问
} as const;

/**
 * 应用根组件
 *
 * 动态遍历 moduleRegistry 中注册的所有模块，
 * 根据模块的 guard 类型自动包裹对应的路由守卫。
 */
const App: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const initTheme = useThemeStore((s) => s.initTheme);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#667eea',
          colorLink: '#667eea',
          colorSuccess: '#52c41a',
          colorWarning: '#ffa940',
          colorError: '#ff6b6b',
          borderRadius: 8,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        },
        components: {
          Button: { borderRadius: 8 },
          Input: { borderRadius: 8 },
          Card: { borderRadiusLG: 16 },
          Modal: { borderRadiusLG: 16 },
        },
      }}
    >
      <Router>
        <Routes>
          {/* 遍历模块注册表，动态生成路由 */}
          {modules.map((mod) =>
            mod.routes.map((route) => {
              // 根据模块 guard 类型选择对应的守卫组件
              const Guard = mod.guard && mod.guard !== 'none' ? guardMap[mod.guard] : null;
              const element = Guard
                ? React.createElement(Guard, null, route.element as React.ReactNode)
                : (route.element as React.ReactElement);
              return (
                <Route
                  key={`${mod.name}-${route.path}`}
                  path={route.path}
                  element={element}
                />
              );
            }),
          )}
        </Routes>
      </Router>
    </ConfigProvider>
  );
};

export default App;
