import type { ClientModule } from '../../core/types';

/**
 * 聊天模块定义
 *
 * 聊天 UI 嵌入在 Home 页面中，不需要独立路由。
 * 通过 stores 和 services 提供聊天功能。
 */
export const chatModule: ClientModule = {
  name: 'chat',
  guard: 'none',
  routes: [],
};
