import express, { type Express } from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { config } from './config';
import { Container } from './core/container';
import { registerRepositories } from './core/registerRepositories';
import type { ServerModule, TypedIO, TypedSocket } from './core/types';

// 功能模块
import { AuthModule } from './modules/auth';
import { UserModule } from './modules/user';
import { ChatModule } from './modules/chat';
import { GroupModule } from './modules/group';

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
  new GroupModule(),
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

// --- 静态文件服务（生产环境：桌面端加载用） ---
const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  // SPA fallback：非 API/Socket/上传请求返回 index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    }
  });
}

export { app, container, socketHandlers };
