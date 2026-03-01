import { Router } from 'express';
import type { ServerModule, ModuleContext, ModuleRegistration, TypedIO, TypedSocket } from '../../core/types';
import { TOKENS } from '../../core/tokens';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';
import type { ISessionRepository } from '../../repositories/interfaces/ISessionRepository';
import type { IMessageRepository } from '../../repositories/interfaces/IMessageRepository';
import { ChatService } from './ChatService';
import { createSessionMiddleware, type AuthenticatedRequest } from '../auth';
import { MESSAGES_PER_PAGE } from '@chat/shared';

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

        res.json({ conversations, participantNames });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // GET /api/chat/conversations/:id/messages — 分页获取会话消息
    router.get('/conversations/:id/messages', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const id = req.params.id as string;
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

    // Socket.IO 事件处理器
    const socketHandler = (io: TypedIO, socket: TypedSocket) => {
      const userId = (socket.data as any).userId as string;
      if (!userId) return;

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

      // message:send — 发送消息
      socket.on('message:send', async (data, callback) => {
        try {
          const message = await chatService.sendMessage(
            userId,
            data.conversationId,
            data.type,
            data.content,
          );

          // 广播给会话中的其他成员
          socket.to(data.conversationId).emit('message:receive', message);

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
