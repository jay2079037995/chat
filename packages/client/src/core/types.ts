import type { RouteObject } from 'react-router-dom';

export interface ClientModule {
  name: string;
  routes: RouteObject[];
  guard?: 'auth' | 'guest' | 'none';
}
