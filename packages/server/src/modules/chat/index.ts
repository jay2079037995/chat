import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import type { ServerModule, ModuleContext, ModuleRegistration, TypedIO, TypedSocket } from '../../core/types';
import { TOKENS } from '../../core/tokens';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';
import type { ISessionRepository } from '../../repositories/interfaces/ISessionRepository';
import type { IMessageRepository } from '../../repositories/interfaces/IMessageRepository';
import { ChatService } from './ChatService';
import { createSessionMiddleware, type AuthenticatedRequest } from '../auth';
import { MESSAGES_PER_PAGE, ALLOWED_AUDIO_TYPES, MAX_AUDIO_SIZE, type Message } from '@chat/shared';
import { imageUpload, fileUpload, getFileUrl } from './upload';
import { getRedisClient } from '../../repositories/redis/RedisClient';

/**
 * 修复 multer originalname 的编码问题
 *
 * busboy 将 Content-Disposition 中的 filename 按 Latin-1 解析，
 * 但浏览器发送的实际是 UTF-8 字节，需要重新解码。
 */
function decodeFileName(name: string): string {
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}

/**
 * 聊天模块
 *
 * 提供一对一私聊功能：会话管理、消息收发、已读状态。
 * REST API 挂载到 /api/chat/*，Socket.IO 处理实时消息。
 */
export class ChatModule implements ServerModule {
  name = 'chat';

  register(ctx: ModuleContext): ModuleRegistration {
    const userRepo = ctx.resolve<IUserRepository>(TOKENS.UserRepository);
    const sessionRepo = ctx.resolve<ISessionRepository>(TOKENS.SessionRepository);
    const messageRepo = ctx.resolve<IMessageRepository>(TOKENS.MessageRepository);

    const chatService = new ChatService(messageRepo);
    const sessionMiddleware = createSessionMiddleware(sessionRepo, userRepo);

    const router = Router();

    // GET /api/chat/conversations — 获取当前用户的会话列表（附带参与者用户名）
    router.get('/conversations', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const conversations = await chatService.getConversations(req.userId!);

        // 解析所有参与者的用户名
        const participantNames: Record<string, string> = {};
        const allParticipantIds = new Set(conversations.flatMap((c) => c.participants));
        for (const pid of allParticipantIds) {
          if (!participantNames[pid]) {
            const user = await userRepo.findById(pid);
            participantNames[pid] = user?.username || pid;
          }
        }

        // 解析群组名称
        const groupNames: Record<string, string> = {};
        const redis = getRedisClient();
        for (const conv of conversations) {
          if (conv.type === 'group') {
            const groupData = await redis.hgetall(conv.id);
            if (groupData?.name) {
              groupNames[conv.id] = groupData.name;
            }
          }
        }

        res.json({ conversations, participantNames, groupNames });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // GET /api/chat/messages/search — 搜索聊天记录（跨用户所有会话）
    router.get('/messages/search', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const keyword = (req.query.q as string || '').trim();
        if (!keyword) {
          res.status(400).json({ error: '请输入搜索关键词' });
          return;
        }

        const messages = await chatService.searchMessages(req.userId!, keyword);
        res.json({ messages });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // GET /api/chat/conversations/:id/messages — 分页获取会话消息
    router.get('/conversations/:id/messages', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const id = req.params.id as string;

        // 权限检查：验证用户是会话参与者
        const conv = await chatService.getConversation(id);
        if (!conv) {
          res.status(404).json({ error: '会话不存在' });
          return;
        }
        if (!conv.participants.includes(req.userId!)) {
          res.status(403).json({ error: '无权访问该会话' });
          return;
        }

        const offset = parseInt(req.query.offset as string, 10) || 0;
        const limit = parseInt(req.query.limit as string, 10) || MESSAGES_PER_PAGE;

        const messages = await chatService.getMessages(id, offset, limit);
        res.json({ messages });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // POST /api/chat/conversations/private — 创建/获取私聊会话
    router.post('/conversations/private', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const { targetUserId } = req.body;

        if (!targetUserId) {
          res.status(400).json({ error: '请指定目标用户' });
          return;
        }

        if (targetUserId === req.userId) {
          res.status(400).json({ error: '不能和自己聊天' });
          return;
        }

        // 验证目标用户存在
        const targetUser = await userRepo.findById(targetUserId);
        if (!targetUser) {
          res.status(404).json({ error: '目标用户不存在' });
          return;
        }

        const conversation = await chatService.getOrCreatePrivateConversation(req.userId!, targetUserId);

        // 返回参与者用户名
        const currentUser = await userRepo.findById(req.userId!);
        const participantNames: Record<string, string> = {
          [req.userId!]: currentUser?.username || req.userId!,
          [targetUserId]: targetUser.username,
        };

        res.json({ conversation, participantNames });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // POST /api/chat/conversations/:id/read — 标记会话已读
    router.post('/conversations/:id/read', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        await chatService.markAsRead(req.params.id as string, req.userId!);
        res.json({ success: true });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // POST /api/chat/upload/image — 上传图片
    router.post('/upload/image', sessionMiddleware, (req: Request, res: Response, next: NextFunction) => {
      imageUpload.single('file')(req, res, (err: any) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ error: '文件过大' });
          return;
        }
        if (err?.message === 'UNSUPPORTED_IMAGE_TYPE') {
          res.status(400).json({ error: '不支持的文件类型' });
          return;
        }
        if (err) {
          res.status(500).json({ error: '上传失败' });
          return;
        }

        const file = req.file;
        if (!file) {
          res.status(400).json({ error: '请选择文件' });
          return;
        }

        res.json({
          url: getFileUrl(file.path),
          fileName: decodeFileName(file.originalname),
          fileSize: file.size,
          mimeType: file.mimetype,
        });
      });
    });

    // POST /api/chat/upload/file — 上传通用文件（含音频）
    router.post('/upload/file', sessionMiddleware, (req: Request, res: Response, next: NextFunction) => {
      fileUpload.single('file')(req, res, (err: any) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ error: '文件过大' });
          return;
        }
        if (err) {
          res.status(500).json({ error: '上传失败' });
          return;
        }

        const file = req.file;
        if (!file) {
          res.status(400).json({ error: '请选择文件' });
          return;
        }

        // 音频文件额外校验
        if (file.mimetype.startsWith('audio/')) {
          if (!ALLOWED_AUDIO_TYPES.includes(file.mimetype)) {
            res.status(400).json({ error: '不支持的音频类型' });
            return;
          }
          if (file.size > MAX_AUDIO_SIZE) {
            res.status(413).json({ error: '音频文件过大' });
            return;
          }
        }

        res.json({
          url: getFileUrl(file.path),
          fileName: decodeFileName(file.originalname),
          fileSize: file.size,
          mimeType: file.mimetype,
        });
      });
    });

    // Socket.IO 事件处理器
    const socketHandler = (io: TypedIO, socket: TypedSocket) => {
      const userId = (socket.data as any).userId as string;
      if (!userId) return;

      // 加入个人房间，方便按 userId 查找 socket
      void socket.join(`user:${userId}`);

      // 连接时自动加入用户所有已有会话的房间
      void (async () => {
        try {
          const conversations = await chatService.getConversations(userId);
          for (const conv of conversations) {
            void socket.join(conv.id);
          }
        } catch (err) {
          console.error('加入会话房间失败:', err);
        }
      })();

      // 连接时推送离线消息
      void (async () => {
        try {
          const redis = getRedisClient();
          const key = `offline_msgs:${userId}`;
          const rawMsgs = await redis.lrange(key, 0, -1);
          if (rawMsgs.length > 0) {
            const messages: Message[] = rawMsgs.map((r) => JSON.parse(r));
            messages.sort((a, b) => a.createdAt - b.createdAt);
            socket.emit('sync:offline_messages', messages);
            await redis.del(key);
          }
        } catch (err) {
          console.error('推送离线消息失败:', err);
        }
      })();

      // message:send — 发送消息
      socket.on('message:send', async (data, callback) => {
        try {
          const message = await chatService.sendMessage(
            userId,
            data.conversationId,
            data.type,
            data.content,
            {
              fileName: data.fileName,
              fileSize: data.fileSize,
              mimeType: data.mimeType,
              codeLanguage: data.codeLanguage,
            },
          );

          // 确保会话中所有在线参与者的 socket 都加入了该房间
          const conv = await chatService.getConversation(data.conversationId);
          if (conv) {
            for (const participantId of conv.participants) {
              const sockets = await io.in(`user:${participantId}`).fetchSockets();
              for (const s of sockets) {
                s.join(data.conversationId);
              }
            }
          }

          // 广播给会话中的其他成员
          socket.to(data.conversationId).emit('message:receive', message);

          // 检查离线参与者，将消息存入离线队列
          if (conv) {
            const redis = getRedisClient();
            const onlineUserIds = await messageRepo.getOnlineUsers();
            const onlineSet = new Set(onlineUserIds);
            for (const pid of conv.participants) {
              if (pid !== userId && !onlineSet.has(pid)) {
                await redis.rpush(`offline_msgs:${pid}`, JSON.stringify(message));
              }
            }
          }

          // 通过 callback 返回持久化后的消息给发送者
          callback(message);
        } catch (err) {
          console.error('发送消息失败:', err);
        }
      });

      // message:read — 标记已读
      socket.on('message:read', async (data) => {
        try {
          await chatService.markAsRead(data.conversationId, userId);

          // 通知会话中的其他成员
          socket.to(data.conversationId).emit('message:read', {
            conversationId: data.conversationId,
            userId,
          });
        } catch (err) {
          console.error('标记已读失败:', err);
        }
      });

      // conversation:join — 加入会话房间
      socket.on('conversation:join', (conversationId) => {
        void socket.join(conversationId);
      });
    };

    return { router, socketHandler };
  }
}
