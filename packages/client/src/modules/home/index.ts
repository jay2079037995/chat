import React from 'react';
import type { ClientModule } from '../../core/types';
import Home from './pages/Home';

/**
 * 主页模块定义
 *
 * guard='auth' 表示需要登录才能访问（未登录自动跳转登录页）。
 * 路径 '/*' 匹配所有未被其他模块处理的路由。
 */
export const homeModule: ClientModule = {
  name: 'home',
  guard: 'auth',
  routes: [
    { path: '/*', element: React.createElement(Home) },
  ],
};
