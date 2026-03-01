import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { app, socketHandlers } from './app';
import { config } from './config';
import type { ServerToClientEvents, ClientToServerEvents } from '@chat/shared';

const server = http.createServer(app);

const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // 注册各模块的 Socket 事件处理器
  for (const handler of socketHandlers) {
    handler(io, socket);
  }

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

export { server, io };
