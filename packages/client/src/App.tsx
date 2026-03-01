import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AuthGuard from './components/AuthGuard';
import GuestGuard from './components/GuestGuard';
import { modules } from './core/moduleRegistry';

const guardMap = {
  auth: AuthGuard,
  guest: GuestGuard,
} as const;

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          {modules.map((mod) =>
            mod.routes.map((route) => {
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
