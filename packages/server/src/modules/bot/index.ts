import { Router } from 'express';
import type { ServerModule, ModuleContext, ModuleRegistration, TypedIO } from '../../core/types';
import { TOKENS } from '../../core/tokens';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';
import type { ISessionRepository } from '../../repositories/interfaces/ISessionRepository';
import type { IMessageRepository } from '../../repositories/interfaces/IMessageRepository';
import { BotService } from './BotService';
import { createSessionMiddleware, type AuthenticatedRequest } from '../auth';

/**
 * 机器人模块
 *
 * 提供机器人创建/删除/列表（需 session 认证），
 * 以及 getUpdates/sendMessage（通过 bot token 认证）。
 * 路由挂载到 /api/bot/*
 */
export class BotModule implements ServerModule {
  name = 'bot';

  /** 保存 TypedIO 引用，用于 sendMessage 后广播 */
  private io: TypedIO | null = null;

  setIO(io: TypedIO) {
    this.io = io;
  }

  register(ctx: ModuleContext): ModuleRegistration {
    const userRepo = ctx.resolve<IUserRepository>(TOKENS.UserRepository);
    const sessionRepo = ctx.resolve<ISessionRepository>(TOKENS.SessionRepository);
    const messageRepo = ctx.resolve<IMessageRepository>(TOKENS.MessageRepository);

    const botService = new BotService(userRepo, messageRepo);
    // 注册 BotService 到容器，供 ChatModule 使用
    (ctx as any).registerInstance?.(TOKENS.BotService, botService);

    const sessionMiddleware = createSessionMiddleware(sessionRepo, userRepo);
    const router = Router();

    // POST /api/bot/create — 创建机器人（需 session）
    router.post('/create', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const { username } = req.body;
        if (!username || typeof username !== 'string' || username.trim().length === 0) {
          res.status(400).json({ error: '请输入机器人用户名' });
          return;
        }

        const result = await botService.createBot(req.userId!, username.trim());
        res.json({
          bot: {
            id: result.id,
            username: result.username,
            ownerId: result.botOwnerId!,
            createdAt: result.createdAt,
          },
          token: result.token,
        });
      } catch (err: unknown) {
        const error = err as Error;
        if (error.message === 'BOT_NAME_INVALID') {
          res.status(400).json({ error: '机器人用户名必须以 bot 结尾' });
          return;
        }
        if (error.message === 'USERNAME_TAKEN') {
          res.status(409).json({ error: '用户名已被占用' });
          return;
        }
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // GET /api/bot/list — 我的机器人列表（需 session）
    router.get('/list', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const bots = await botService.listBots(req.userId!);
        res.json({
          bots: bots.map((b) => ({
            id: b.id,
            username: b.username,
            ownerId: b.botOwnerId!,
            createdAt: b.createdAt,
          })),
        });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // DELETE /api/bot/:id — 删除机器人（需 session）
    router.delete('/:id', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        await botService.deleteBot(req.params.id as string, req.userId!);
        res.json({ success: true });
      } catch (err: unknown) {
        const error = err as Error;
        if (error.message === 'BOT_NOT_FOUND') {
          res.status(404).json({ error: '机器人不存在' });
          return;
        }
        if (error.message === 'FORBIDDEN') {
          res.status(403).json({ error: '无权操作该机器人' });
          return;
        }
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // GET /api/bot/getUpdates — 长轮询获取消息（通过 token 认证）
    router.get('/getUpdates', async (req, res) => {
      try {
        const token = req.query.token as string;
        if (!token) {
          res.status(400).json({ error: '缺少 token 参数' });
          return;
        }

        const timeout = Math.min(parseInt(req.query.timeout as string, 10) || 30, 60);
        const updates = await botService.getUpdates(token, timeout);
        res.json({ updates });
      } catch (err: unknown) {
        const error = err as Error;
        if (error.message === 'INVALID_TOKEN') {
          res.status(401).json({ error: 'Token 无效' });
          return;
        }
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // POST /api/bot/sendMessage — 机器人发消息（通过 token 认证）
    router.post('/sendMessage', async (req, res) => {
      try {
        const { token, conversationId, content, type } = req.body;
        if (!token || !conversationId || !content) {
          res.status(400).json({ error: '缺少必要参数 (token, conversationId, content)' });
          return;
        }

        const message = await botService.sendMessage(token, conversationId, content, type);

        // 通过 Socket.IO 广播给会话中的在线用户
        if (this.io) {
          this.io.to(conversationId).emit('message:receive', message);
        }

        res.json({ message });
      } catch (err: unknown) {
        const error = err as Error;
        if (error.message === 'INVALID_TOKEN') {
          res.status(401).json({ error: 'Token 无效' });
          return;
        }
        if (error.message === 'CONVERSATION_NOT_FOUND') {
          res.status(404).json({ error: '会话不存在' });
          return;
        }
        if (error.message === 'NOT_PARTICIPANT') {
          res.status(403).json({ error: '机器人不是该会话的参与者' });
          return;
        }
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    return { router };
  }
}
