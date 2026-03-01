import type { RouteObject } from 'react-router-dom';

/**
 * 前端功能模块接口
 *
 * 每个功能模块（auth、home、chat 等）实现此接口，
 * 提供自己的路由定义和路由守卫类型。
 */
export interface ClientModule {
  /** 模块名称（用于路由 key 前缀） */
  name: string;
  /** 模块路由列表 */
  routes: RouteObject[];
  /** 路由守卫类型：auth=需登录，guest=仅未登录可访问，none=无守卫 */
  guard?: 'auth' | 'guest' | 'none';
}
