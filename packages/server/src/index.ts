import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { app, container, socketHandlers, botModule } from './app';
import { config } from './config';
import { TOKENS } from './core/tokens';
import type { ServerToClientEvents, ClientToServerEvents } from '@chat/shared';
import type { ISessionRepository } from './repositories/interfaces/ISessionRepository';
import type { IMessageRepository } from './repositories/interfaces/IMessageRepository';
import { getRedisClient } from './repositories/redis/RedisClient';

const server = http.createServer(app);

const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Socket.IO 认证中间件：验证 Session ID
const sessionRepo = container.resolve<ISessionRepository>(TOKENS.SessionRepository);
const messageRepo = container.resolve<IMessageRepository>(TOKENS.MessageRepository);

io.use(async (socket, next) => {
  const sessionId = socket.handshake.auth.sessionId as string;

  if (!sessionId) {
    return next(new Error('Session ID required'));
  }

  const userId = await sessionRepo.validate(sessionId);
  if (!userId) {
    return next(new Error('Invalid session'));
  }

  (socket.data as any).userId = userId;
  (socket.data as any).sessionId = sessionId;
  next();
});

// 将 Socket.IO 引用传给 BotModule，用于机器人发消息后广播
botModule.setIO(io);

// 初始化 ToolDispatcher
botModule.toolDispatcher.setIO(io);

// 初始化服务端 Bot 管理器
if (botModule.serverBotManager) {
  botModule.serverBotManager.setIO(io);
  botModule.serverBotManager.setToolDispatcher(botModule.toolDispatcher);
  void botModule.serverBotManager.recoverRunningBots().then(() => {
    console.log('Server bot recovery completed');
  }).catch((err) => {
    console.error('Server bot recovery failed:', err);
  });
}

// 服务器启动时清除上一次残留的在线状态（防止重启后 Redis 中有脏数据）
void (async () => {
  const redis = getRedisClient();
  await redis.del('online_users');
  await redis.del('user_sockets');
  console.log('Cleared stale online presence data');
})();

io.on('connection', async (socket) => {
  const userId = (socket.data as any).userId as string;
  console.log(`Client connected: ${socket.id} (user: ${userId})`);

  // 标记用户在线并广播
  await messageRepo.setUserOnline(userId, socket.id);
  socket.broadcast.emit('user:online', userId);

  // 向新连接的客户端下发当前所有在线用户列表
  const onlineUsers = await messageRepo.getOnlineUsers();
  socket.emit('users:online_list', onlineUsers);

  // 注册各模块的 Socket 事件处理器
  for (const handler of socketHandlers) {
    handler(io, socket);
  }

  socket.on('disconnect', async () => {
    console.log(`Client disconnected: ${socket.id} (user: ${userId})`);

    // 标记用户离线并广播
    await messageRepo.setUserOffline(userId);
    socket.broadcast.emit('user:offline', userId);
  });
});

server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

export { server, io };
