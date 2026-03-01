import express, { type Express } from 'express';
import path from 'path';
import cors from 'cors';
import { config } from './config';
import { Container } from './core/container';
import { registerRepositories } from './core/registerRepositories';
import type { ServerModule, TypedIO, TypedSocket } from './core/types';

// 功能模块
import { AuthModule } from './modules/auth';
import { UserModule } from './modules/user';
import { ChatModule } from './modules/chat';

// 初始化 DI 容器
const container = new Container();
registerRepositories(container);

const app: Express = express();

app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 — 上传的文件通过 /uploads/* 路径访问
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// --- 模块注册 ---
const modules: ServerModule[] = [
  new AuthModule(),
  new UserModule(),
  new ChatModule(),
  // new GroupModule(),   // v0.5.0
];

const socketHandlers: Array<(io: TypedIO, socket: TypedSocket) => void> = [];

for (const mod of modules) {
  const registration = mod.register(container);

  if (registration.router) {
    app.use(`/api/${mod.name}`, registration.router);
  }

  if (registration.socketHandler) {
    socketHandlers.push(registration.socketHandler);
  }
}

export { app, container, socketHandlers };
