import { Router } from 'express';
import type { ServerModule, ModuleContext, ModuleRegistration, TypedIO } from '../../core/types';
import { TOKENS } from '../../core/tokens';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';
import type { ISessionRepository } from '../../repositories/interfaces/ISessionRepository';
import type { IMessageRepository } from '../../repositories/interfaces/IMessageRepository';
import type { BotRunMode, LLMConfig, MastraLLMConfig, Message, MessageMetadata } from '@chat/shared';
import { LLM_PROVIDERS, MASTRA_PROVIDERS, generateId } from '@chat/shared';
import { Agent } from '@mastra/core/agent';
import { BotService } from './BotService';
import { ServerBotManager } from './ServerBotManager';
import { ToolDispatcher } from './ToolDispatcher';
import { createModel } from './ModelFactory';
import { createServerTools } from './ServerToolBridge';
import { saveBase64File } from '../chat/upload';
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

  /** 通用工具分发器（供 Socket handler 使用） */
  readonly toolDispatcher = new ToolDispatcher();

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

        const mode: BotRunMode = runMode === 'server' ? 'server' : runMode === 'local' ? 'local' : 'client';

        // local 模式需要 mastraConfig
        const { mastraConfig } = req.body;
        if (mode === 'local' && !mastraConfig) {
          res.status(400).json({ error: '本地模式需要提供 Mastra 配置' });
          return;
        }

        const result = await botService.createBot(req.userId!, username.trim(), mode, llmConfig, mastraConfig);

        // 服务端模式：自动启动 Bot
        if (mode === 'server' && llmConfig && this.serverBotManager) {
          await this.serverBotManager.startBot(result.id, llmConfig);
        }

        const maskedConfig = mode === 'server'
          ? await botService.getServerBotConfigMasked(result.id)
          : undefined;

        const maskedMastraConfig = mode === 'local'
          ? await botService.getMastraConfigMasked(result.id)
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
            mastraConfig: maskedMastraConfig,
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
        if (error.message === 'LOCAL_MODE_REQUIRES_MASTRA_CONFIG') {
          res.status(400).json({ error: '本地模式需要提供 Mastra 配置' });
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

            if (runMode === 'local') {
              const mastraConfig = await botService.getMastraConfigMasked(b.id);
              return { ...base, mastraConfig };
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

    // GET /api/bot/:id/config — 获取 Bot 完整配置（需 session + 所有权，仅 local 模式）
    router.get('/:id/config', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
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
        if (runMode === 'local') {
          const mastraConfig = await botService.getMastraConfig(botId);
          res.json({ mastraConfig });
          return;
        }
        if (runMode === 'server') {
          const llmConfig = await botService.getServerBotConfig(botId);
          res.json({ llmConfig });
          return;
        }

        res.status(400).json({ error: '该模式不支持配置查询' });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // PUT /api/bot/:id/config — 更新 Bot 配置（需 session + 所有权）
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

        // 本地模式：更新 Mastra 配置
        if (runMode === 'local') {
          const mastraConfig = req.body as MastraLLMConfig;
          if (!mastraConfig.provider || !mastraConfig.apiKey || !mastraConfig.model) {
            res.status(400).json({ error: '缺少必要的 Mastra 配置字段' });
            return;
          }
          // 如果 apiKey 是脱敏值，保留原始值
          if (mastraConfig.apiKey.includes('****')) {
            const existing = await botService.getMastraConfig(botId);
            if (existing) {
              mastraConfig.apiKey = existing.apiKey;
            }
          }
          await botService.saveMastraConfig(botId, mastraConfig);
          const masked = await botService.getMastraConfigMasked(botId);
          res.json({ mastraConfig: masked });
          return;
        }

        // 服务端模式：更新 LLM 配置
        if (runMode !== 'server') {
          res.status(400).json({ error: '该模式不支持配置更新' });
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

    // GET /api/bot/:id/logs — 获取 LLM 调用日志（需 session + 所有权）
    router.get('/:id/logs', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
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

        const offset = parseInt(req.query.offset as string, 10) || 0;
        const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
        const result = await botService.getLLMCallLogs(botId, offset, limit);
        res.json(result);
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // DELETE /api/bot/:id/logs — 清空 LLM 调用日志（需 session + 所有权）
    router.delete('/:id/logs', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
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

        await botService.clearLLMCallLogs(botId);
        res.json({ success: true });
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // POST /api/bot/chat — AI SDK 流式聊天（需 session）
    router.post('/chat', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
      try {
        const { messages, conversationId, botId } = req.body;
        if (!messages || !conversationId || !botId) {
          res.status(400).json({ error: '缺少必要参数 (messages, conversationId, botId)' });
          return;
        }

        // 验证 bot 存在
        const bot = await userRepo.findById(botId);
        if (!bot || !bot.isBot) {
          res.status(404).json({ error: '机器人不存在' });
          return;
        }

        // 加载 bot 配置
        const runMode = await botService.getBotRunMode(botId);
        let llmConfig: LLMConfig | MastraLLMConfig | null = null;
        if (runMode === 'local') {
          llmConfig = await botService.getMastraConfig(botId);
        } else if (runMode === 'server') {
          llmConfig = await botService.getServerBotConfig(botId);
        }
        if (!llmConfig) {
          res.status(400).json({ error: 'Bot 配置不存在' });
          return;
        }

        // 保存用户消息到 DB
        const lastUserMsg = messages[messages.length - 1];
        if (lastUserMsg && lastUserMsg.role === 'user') {
          const msg: Message = {
            id: generateId(),
            conversationId,
            senderId: req.userId!,
            content: lastUserMsg.content,
            type: 'text',
            createdAt: Date.now(),
          };
          await messageRepo.saveMessage(msg);
          if (this.io) {
            this.io.to(conversationId).emit('message:receive', msg);
          }
        }

        // 构建系统提示词（含 skill 指令）
        const skillInstructions = serverBotManager?.getSkillInstructions(botId) || '';
        const basePrompt = llmConfig.systemPrompt || '';
        const systemPrompt = basePrompt + (skillInstructions ? '\n\n' + skillInstructions : '');

        // 创建 model + tools
        const model = await createModel(llmConfig);
        let pendingMetadata: MessageMetadata | undefined;
        const targetUserId = bot.botOwnerId || '';
        // 推理模型不支持 function calling
        const isReasoner = llmConfig.model === 'deepseek-reasoner';
        const pendingFileArtifacts: import('./ServerToolBridge').FileArtifact[] = [];
        const tools = !isReasoner && targetUserId && toolDispatcher ? createServerTools({
          dispatcher: toolDispatcher,
          targetUserId,
          botId,
          conversationId,
          onPresentChoices: (m) => { pendingMetadata = m; },
          onFileArtifact: (a) => { pendingFileArtifacts.push(a); },
        }) : undefined;

        // Mastra Agent stream
        const agent = new Agent({
          id: `chat-bot-${botId}`,
          name: `chat-bot-${botId}`,
          instructions: systemPrompt || 'You are a helpful assistant.',
          model,
          tools: tools || undefined,
        });

        console.log('[BotChat] Starting stream for bot:', botId, 'model:', llmConfig.model);
        const streamResult = await agent.streamLegacy(
          messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })) as any,
          { maxSteps: tools ? 5 : 1 },
        );

        // 手动输出 AI SDK data stream protocol（与 useChat SSE 格式兼容）
        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Vercel-AI-Data-Stream': 'v1',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        let fullText = '';
        const ioRef = this.io;

        // 安全消费 ReadableStream（兼容 Mastra MastraModelOutput.textStream）
        const reader = streamResult.textStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullText += value;
            // AI SDK data stream protocol: 0:"chunk"\n
            res.write(`0:${JSON.stringify(value)}\n`);
          }
        } finally {
          reader.releaseLock();
        }

        // 发送 finish 信号
        res.write(`d:${JSON.stringify({ finishReason: 'stop' })}\n`);
        res.end();

        // 流结束后保存消息到 DB
        if (fullText) {
          try {
            const isMarkdown = /[#*`\[\]|>]/.test(fullText) && fullText.length > 20;
            const botMsg: Message = {
              id: generateId(),
              conversationId,
              senderId: botId,
              content: fullText,
              type: isMarkdown ? 'markdown' : 'text',
              ...(pendingMetadata ? { metadata: pendingMetadata } : {}),
              createdAt: Date.now(),
            };
            await messageRepo.saveMessage(botMsg);
            if (ioRef) {
              ioRef.to(conversationId).emit('message:receive', botMsg);
            }

            // 保存对话历史到 Redis
            if (lastUserMsg) {
              await botService.saveConvHistory(botId, conversationId, {
                role: 'user', content: lastUserMsg.content,
              });
            }
            await botService.saveConvHistory(botId, conversationId, {
              role: 'assistant', content: fullText,
            });

            // 发送文件产物到聊天
            for (const artifact of pendingFileArtifacts) {
              try {
                const { url } = saveBase64File(artifact.base64, artifact.fileName, artifact.mimeType);
                const isImage = artifact.mimeType.startsWith('image/');
                const fileMsg = await botService.sendFileMessageByBotId(
                  botId, conversationId, url,
                  isImage ? 'image' : 'file',
                  artifact.fileName, artifact.fileSize, artifact.mimeType,
                );
                if (ioRef) {
                  ioRef.to(conversationId).emit('message:receive', fileMsg);
                }
              } catch (fileErr: any) {
                console.error('[BotChat] 文件产物发送失败:', fileErr.message);
              }
            }
          } catch (saveErr) {
            console.error('[BotChat] Save after stream error:', saveErr);
          }
        }
      } catch (err) {
        console.error('[BotChat] Streaming error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: '流式聊天失败' });
        }
      }
    });

    // GET /api/bot/providers — 获取可用 LLM providers 及模型列表
    router.get('/providers', (_req, res) => {
      res.json({ providers: LLM_PROVIDERS });
    });

    // GET /api/bot/mastra-providers — 获取可用 Mastra providers 及模型列表
    router.get('/mastra-providers', (_req, res) => {
      res.json({ providers: MASTRA_PROVIDERS });
    });

    // Socket handler：监听 tool:result + bot:skill-instructions
    const toolDispatcher = this.toolDispatcher;
    const serverBotManager = this.serverBotManager;
    const socketHandler = (io: TypedIO, socket: import('../../core/types').TypedSocket) => {
      // 通用工具执行结果（Electron → Server）
      socket.on('tool:result', (result) => {
        toolDispatcher.handleResult(result);
      });

      // Skill 指令推送（Electron → Server）
      socket.on('bot:skill-instructions', (data: { botId: string; instructions: string }) => {
        if (serverBotManager) {
          serverBotManager.setSkillInstructions(data.botId, data.instructions);
        }
      });
    };

    return { router, socketHandler };
  }
}
