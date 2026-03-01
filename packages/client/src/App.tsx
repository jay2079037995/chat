import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AuthGuard from './components/AuthGuard';
import GuestGuard from './components/GuestGuard';
import { modules } from './core/moduleRegistry';

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
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
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
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
