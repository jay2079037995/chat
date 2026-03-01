import React from 'react';
import type { ClientModule } from '../../core/types';
import Login from './pages/Login';
import Register from './pages/Register';

/**
 * 认证模块定义
 *
 * guard='guest' 表示这些页面仅未登录用户可访问（已登录自动跳转主页）。
 */
export const authModule: ClientModule = {
  name: 'auth',
  guard: 'guest',
  routes: [
    { path: '/login', element: React.createElement(Login) },
    { path: '/register', element: React.createElement(Register) },
  ],
};
