import type { ClientModule } from './types';
import { authModule } from '../modules/auth';
import { homeModule } from '../modules/home';

/**
 * 模块注册表
 *
 * 添加新模块只需在此数组中导入并添加一行。
 * App.tsx 会自动遍历所有模块并渲染对应路由。
 */
export const modules: ClientModule[] = [authModule, homeModule];
