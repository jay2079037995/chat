import React from 'react';
import type { ClientModule } from '../../core/types';
import Home from './pages/Home';

export const homeModule: ClientModule = {
  name: 'home',
  guard: 'auth',
  routes: [
    { path: '/*', element: React.createElement(Home) },
  ],
};
