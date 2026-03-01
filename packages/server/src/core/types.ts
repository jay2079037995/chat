import type { Router } from 'express';
import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@chat/shared';

export type TypedIO = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * 模块上下文 — 提供依赖解析能力
 */
export interface ModuleContext {
  resolve<T>(token: string): T;
}

/**
 * 模块注册返回值
 */
export interface ModuleRegistration {
  /** REST API 路由，挂载到 /api/{module.name} */
  router?: Router;
  /** Socket.IO 事件处理器，每个新连接调用 */
  socketHandler?: (io: TypedIO, socket: TypedSocket) => void;
}

/**
 * 后端功能模块接口
 *
 * 每个功能（auth、user、chat、group 等）实现此接口，
 * 实现功能解耦和独立开发/移除/定制。
 */
export interface ServerModule {
  /** 模块名称，用作路由前缀 /api/{name} */
  name: string;
  /** 注册模块：创建服务、定义路由、绑定 Socket 事件 */
  register(ctx: ModuleContext): ModuleRegistration;
}
