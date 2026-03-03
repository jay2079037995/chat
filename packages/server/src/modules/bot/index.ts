import { Router } from 'express';
import type { ServerModule, ModuleContext, ModuleRegistration, TypedIO } from '../../core/types';
import { TOKENS } from '../../core/tokens';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';
import type { ISessionRepository } from '../../repositories/interfaces/ISessionRepository';
import type { IMessageRepository } from '../../repositories/interfaces/IMessageRepository';
import type { BotRunMode, LLMConfig } from '@chat/shared';
import { LLM_PROVIDERS } from '@chat/shared';
import { BotService } from './BotService';
import { ServerBotManager } from './ServerBotManager';
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

  /** 服务端 Bot 管理器 */
  serverBotManager: ServerBotManager | null = null;

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

    // 创建服务端 Bot 管理器
    this.serverBotManager = new ServerBotManager(botService);

    const sessionMiddleware = createSessionMiddleware(sessionRepo, userRepo);
    const router = Router();

    // POST /api/bot/create — 创建机器人（需 session）
    router.post('/create', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const { username, runMode, llmConfig } = req.body;
        if (!username || typeof username !== 'string' || username.trim().length === 0) {
          res.status(400).json({ error: '请输入机器人用户名' });
          return;
        }

        const mode: BotRunMode = runMode === 'server' ? 'server' : 'client';
        const result = await botService.createBot(req.userId!, username.trim(), mode, llmConfig);

        // 服务端模式：自动启动 Bot
        if (mode === 'server' && llmConfig && this.serverBotManager) {
          await this.serverBotManager.startBot(result.id, llmConfig);
        }

        const maskedConfig = mode === 'server'
          ? await botService.getServerBotConfigMasked(result.id)
          : undefined;

        res.json({
          bot: {
            id: result.id,
            username: result.username,
            ownerId: result.botOwnerId!,
            createdAt: result.createdAt,
            runMode: mode,
            status: mode === 'server' ? 'running' : undefined,
            llmConfig: maskedConfig,
          },
          token: mode === 'client' ? result.token : undefined,
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
        if (error.message === 'SERVER_MODE_REQUIRES_LLM_CONFIG') {
          res.status(400).json({ error: '服务端模式需要提供 LLM 配置' });
          return;
        }
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // GET /api/bot/list — 我的机器人列表（需 session）
    router.get('/list', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const bots = await botService.listBots(req.userId!);
        const enriched = await Promise.all(
          bots.map(async (b) => {
            const runMode = await botService.getBotRunMode(b.id);
            const base = {
              id: b.id,
              username: b.username,
              ownerId: b.botOwnerId!,
              createdAt: b.createdAt,
              runMode,
            };

            if (runMode === 'server') {
              const { status, error } = await botService.getBotStatus(b.id);
              const llmConfig = await botService.getServerBotConfigMasked(b.id);
              return { ...base, status, statusError: error, llmConfig };
            }

            return base;
          }),
        );

        res.json({ bots: enriched });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // DELETE /api/bot/:id — 删除机器人（需 session）
    router.delete('/:id', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        // 先停止运行中的服务端 Bot
        if (this.serverBotManager) {
          await this.serverBotManager.stopBot(req.params.id as string);
        }

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

    // GET /api/bot/getHistory — 获取会话历史消息（通过 token 认证）
    router.get('/getHistory', async (req, res) => {
      try {
        const token = req.query.token as string;
        if (!token) {
          res.status(400).json({ error: '缺少 token 参数' });
          return;
        }
        const conversationId = req.query.conversationId as string;
        if (!conversationId) {
          res.status(400).json({ error: '缺少 conversationId 参数' });
          return;
        }

        const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
        const offset = parseInt(req.query.offset as string, 10) || 0;

        const result = await botService.getHistory(token, conversationId, limit, offset);
        res.json(result);
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

    // PUT /api/bot/:id/config — 更新服务端 Bot LLM 配置（需 session + 所有权）
    router.put('/:id/config', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const botId = req.params.id as string;
        const bot = await userRepo.findById(botId);
        if (!bot || !bot.isBot) {
          res.status(404).json({ error: '机器人不存在' });
          return;
        }
        if (bot.botOwnerId !== req.userId) {
          res.status(403).json({ error: '无权操作该机器人' });
          return;
        }

        const runMode = await botService.getBotRunMode(botId);
        if (runMode !== 'server') {
          res.status(400).json({ error: '仅服务端模式机器人支持配置更新' });
          return;
        }

        const llmConfig = req.body as LLMConfig;
        if (!llmConfig.provider || !llmConfig.apiKey || !llmConfig.model) {
          res.status(400).json({ error: '缺少必要的 LLM 配置字段' });
          return;
        }

        // 如果 apiKey 是脱敏值（包含 ****），保留原始值
        if (llmConfig.apiKey.includes('****')) {
          const existing = await botService.getServerBotConfig(botId);
          if (existing) {
            llmConfig.apiKey = existing.apiKey;
          }
        }

        await botService.saveServerBotConfig(botId, llmConfig);
        if (this.serverBotManager) {
          this.serverBotManager.updateBotConfig(botId, llmConfig);
        }

        const masked = await botService.getServerBotConfigMasked(botId);
        res.json({ llmConfig: masked });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // POST /api/bot/:id/start — 启动服务端 Bot（需 session + 所有权）
    router.post('/:id/start', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const botId = req.params.id as string;
        const bot = await userRepo.findById(botId);
        if (!bot || !bot.isBot) {
          res.status(404).json({ error: '机器人不存在' });
          return;
        }
        if (bot.botOwnerId !== req.userId) {
          res.status(403).json({ error: '无权操作该机器人' });
          return;
        }

        const runMode = await botService.getBotRunMode(botId);
        if (runMode !== 'server') {
          res.status(400).json({ error: '仅服务端模式机器人支持此操作' });
          return;
        }

        const llmConfig = await botService.getServerBotConfig(botId);
        if (!llmConfig) {
          res.status(400).json({ error: 'LLM 配置不存在' });
          return;
        }

        if (this.serverBotManager) {
          await this.serverBotManager.startBot(botId, llmConfig);
        }

        res.json({ status: 'running' });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // POST /api/bot/:id/stop — 停止服务端 Bot（需 session + 所有权）
    router.post('/:id/stop', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const botId = req.params.id as string;
        const bot = await userRepo.findById(botId);
        if (!bot || !bot.isBot) {
          res.status(404).json({ error: '机器人不存在' });
          return;
        }
        if (bot.botOwnerId !== req.userId) {
          res.status(403).json({ error: '无权操作该机器人' });
          return;
        }

        if (this.serverBotManager) {
          await this.serverBotManager.stopBot(botId);
        }

        res.json({ status: 'stopped' });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // GET /api/bot/providers — 获取可用 LLM providers 及模型列表
    router.get('/providers', (_req, res) => {
      res.json({ providers: LLM_PROVIDERS });
    });

    return { router };
  }
}
