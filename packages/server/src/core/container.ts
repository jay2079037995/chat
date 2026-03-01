import type { ModuleContext } from './types';

/**
 * 轻量级 DI 容器
 *
 * 通过 string token 注册和解析依赖。支持工厂函数（懒加载单例）和直接实例注册。
 * 无装饰器、无 reflect-metadata，保持简单。
 */
export class Container implements ModuleContext {
  private instances = new Map<string, unknown>();
  private factories = new Map<string, () => unknown>();

  /** 注册工厂函数，首次 resolve 时创建单例 */
  registerFactory<T>(token: string, factory: () => T): void {
    this.factories.set(token, factory);
  }

  /** 注册已有实例 */
  registerInstance<T>(token: string, instance: T): void {
    this.instances.set(token, instance);
  }

  /** 解析依赖。工厂函数在首次调用时创建单例。 */
  resolve<T>(token: string): T {
    if (this.instances.has(token)) {
      return this.instances.get(token) as T;
    }
    const factory = this.factories.get(token);
    if (!factory) {
      throw new Error(`[Container] No registration found for token: "${token}"`);
    }
    const instance = factory() as T;
    this.instances.set(token, instance);
    return instance;
  }

  /** 检查 token 是否已注册 */
  has(token: string): boolean {
    return this.instances.has(token) || this.factories.has(token);
  }
}
