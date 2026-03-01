import React from 'react';
import type { ClientModule } from '../../core/types';
import Login from './pages/Login';
import Register from './pages/Register';

export const authModule: ClientModule = {
  name: 'auth',
  guard: 'guest',
  routes: [
    { path: '/login', element: React.createElement(Login) },
    { path: '/register', element: React.createElement(Register) },
  ],
};
