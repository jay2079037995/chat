import { Router } from 'express';
import type { ServerModule, ModuleContext, ModuleRegistration, TypedIO } from '../../core/types';
import { TOKENS } from '../../core/tokens';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';
import type { ISessionRepository } from '../../repositories/interfaces/ISessionRepository';
import type { IMessageRepository } from '../../repositories/interfaces/IMessageRepository';
import type { MastraLLMConfig, Message, MessageMetadata, AgentStepLog, AgentGenerationLog } from '@chat/shared';
import { MASTRA_PROVIDERS, generateId } from '@chat/shared';
import { Agent } from '@mastra/core/agent';
import { BotService } from './BotService';
import { ToolDispatcher } from './ToolDispatcher';
import { createModel } from './ModelFactory';
import { createServerTools } from './ServerToolBridge';
import { saveBase64File } from '../chat/upload';
import { createSessionMiddleware, type AuthenticatedRequest } from '../auth';

/**
 * 机器人模块
 *
 * 提供机器人创建/删除/列表（需 session 认证）。
 * 仅支持本地模式（Electron/Mastra）。
 * 路由挂载到 /api/bot/*
 */
export class BotModule implements ServerModule {
  name = 'bot';

  /** 保存 TypedIO 引用，用于 sendMessage 后广播 */
  private io: TypedIO | null = null;

  /** Skill 指令缓存（bot:skill-instructions 推送） */
  private skillInstructionsCache = new Map<string, string>();

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

        const { mastraConfig } = req.body;
        if (!mastraConfig) {
          res.status(400).json({ error: '需要提供 Mastra 配置' });
          return;
        }

        const result = await botService.createBot(req.userId!, username.trim(), 'local', undefined, mastraConfig);

        const maskedMastraConfig = await botService.getMastraConfigMasked(result.id);

        res.json({
          bot: {
            id: result.id,
            username: result.username,
            ownerId: result.botOwnerId!,
            createdAt: result.createdAt,
            runMode: 'local',
            mastraConfig: maskedMastraConfig,
          },
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
        if (error.message === 'LOCAL_MODE_REQUIRES_MASTRA_CONFIG') {
          res.status(400).json({ error: '需要提供 Mastra 配置' });
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
            const mastraConfig = await botService.getMastraConfigMasked(b.id);
            return {
              id: b.id,
              username: b.username,
              ownerId: b.botOwnerId!,
              createdAt: b.createdAt,
              runMode: 'local' as const,
              mastraConfig,
            };
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

    // GET /api/bot/:id/config — 获取 Bot 配置（需 session + 所有权）
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

        const mastraConfig = await botService.getMastraConfig(botId);
        res.json({ mastraConfig });
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
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // GET /api/bot/:id/generation-logs — 获取 Agent 生成日志（需 session + 所有权）
    router.get('/:id/generation-logs', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
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
        const result = await botService.getAgentGenerationLogs(botId, offset, limit);
        res.json(result);
      } catch {
        res.status(500).json({ error: '服务器内部错误' });
      }
    });

    // DELETE /api/bot/:id/generation-logs — 清空 Agent 生成日志（需 session + 所有权）
    router.delete('/:id/generation-logs', sessionMiddleware, async (req: AuthenticatedRequest, res) => {
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

        await botService.clearAgentGenerationLogs(botId);
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
        const llmConfig = await botService.getMastraConfig(botId);
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

        // 构建系统提示词（含 skill 指令 + 工具说明）
        const skillInstructions = this.skillInstructionsCache.get(botId) || '';
        const basePrompt = llmConfig.systemPrompt || '';
        // 如果无 Skill 推送，补充基础工具说明
        const toolInstructions = !skillInstructions
          ? '\n\n# 工作区环境\n\n你拥有一个专属的工作目录。\n\n## 工具使用说明\n\n你可以使用以下工具来执行任务：\n\n- `bash_exec`: 执行 Shell 命令。命令在工作区目录中运行，无需 cd。\n- `read_file`: 读取文件。相对路径基于工作区目录解析。\n- `write_file`: 写入文件。相对路径基于工作区目录解析。只能写入工作区内的文件。\n- `list_files`: 列出目录。默认列出工作区根目录。\n- `present_choices`: 向用户展示可点击的选项按钮或请求文本输入。\n\n**重要**: 所有相对路径都基于工作区目录解析，bash_exec 的工作目录已设为工作区，直接运行命令即可。'
          : '';
        const systemPrompt = basePrompt + (skillInstructions ? '\n\n' + skillInstructions : '') + toolInstructions;

        // 创建 model + tools + 步骤日志收集
        const model = await createModel(llmConfig);
        let pendingMetadata: MessageMetadata | undefined;
        const targetUserId = bot.botOwnerId || '';
        // 推理模型不支持 function calling
        const isReasoner = llmConfig.model === 'deepseek-reasoner';
        const pendingFileArtifacts: import('./ServerToolBridge').FileArtifact[] = [];

        const generationId = generateId();
        const generationStartTime = Date.now();
        const stepLogs: AgentStepLog[] = [];
        let stepIndex = 0;
        const ioForProgress = this.io;

        const emitProgress = (data: { step: string; status: 'start' | 'complete' | 'error'; detail?: string }) => {
          ioForProgress?.to(conversationId).emit('bot:step-progress', {
            conversationId,
            botId,
            step: data.step,
            status: data.status,
            detail: data.detail,
            timestamp: Date.now(),
          });
        };

        const toolDispatcher = this.toolDispatcher;
        const tools = !isReasoner && targetUserId && toolDispatcher ? createServerTools({
          dispatcher: toolDispatcher,
          targetUserId,
          botId,
          conversationId,
          onPresentChoices: (m) => { pendingMetadata = m; },
          onFileArtifact: (a) => { pendingFileArtifacts.push(a); },
          onStepProgress: (data) => emitProgress(data),
          onToolLog: (log) => {
            stepIndex++;
            stepLogs.push({
              id: generateId(),
              botId,
              conversationId,
              generationId,
              stepIndex,
              type: log.error ? 'error' : 'tool_result',
              timestamp: Date.now(),
              toolName: log.toolName,
              toolInput: log.input,
              toolOutput: log.output,
              error: log.error,
              durationMs: log.durationMs,
            });
          },
        }) : undefined;

        // Mastra Agent stream
        const agent = new Agent({
          id: `chat-bot-${botId}`,
          name: `chat-bot-${botId}`,
          instructions: systemPrompt || 'You are a helpful assistant.',
          model,
          tools: tools || undefined,
        });

        emitProgress({ step: 'generating', status: 'start' });
        console.log('[BotChat] Starting stream for bot:', botId, 'model:', llmConfig.model);
        const llmStartTime = Date.now();
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

        const llmDurationMs = Date.now() - llmStartTime;

        // 记录 LLM 调用步骤
        stepIndex++;
        stepLogs.push({
          id: generateId(),
          botId,
          conversationId,
          generationId,
          stepIndex,
          type: 'llm_call',
          timestamp: Date.now(),
          durationMs: llmDurationMs,
          llmInfo: {
            provider: llmConfig.provider,
            model: llmConfig.model,
            finishReason: 'stop',
          },
        });

        emitProgress({ step: 'generating', status: 'complete' });

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
            // 保存 Agent 生成日志
            await botService.saveAgentGenerationLog({
              generationId,
              botId,
              conversationId,
              startTime: generationStartTime,
              totalDurationMs: Date.now() - generationStartTime,
              stepCount: stepLogs.length,
              success: true,
              steps: stepLogs,
            });
          } catch (saveErr) {
            console.error('[BotChat] Save after stream error:', saveErr);
          }
        }
      } catch (err: any) {
        // emitProgress may not be defined if error happened before its declaration
        try {
          this.io?.to(req.body?.conversationId).emit('bot:step-progress', {
            conversationId: req.body?.conversationId,
            botId: req.body?.botId,
            step: 'generating',
            status: 'error' as const,
            detail: err?.message,
            timestamp: Date.now(),
          });
        } catch { /* ignore */ }
        console.error('[BotChat] Streaming error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: '流式聊天失败' });
        }
      }
    });

    // GET /api/bot/mastra-providers — 获取可用 Mastra providers 及模型列表
    router.get('/mastra-providers', (_req, res) => {
      res.json({ providers: MASTRA_PROVIDERS });
    });

    // Socket handler：监听 tool:result + bot:skill-instructions
    const toolDispatcher = this.toolDispatcher;
    const skillCache = this.skillInstructionsCache;
    const socketHandler = (io: TypedIO, socket: import('../../core/types').TypedSocket) => {
      // 通用工具执行结果（Electron → Server）
      socket.on('tool:result', (result) => {
        toolDispatcher.handleResult(result);
      });

      // Skill 指令推送（Electron → Server）
      socket.on('bot:skill-instructions', (data: { botId: string; instructions: string }) => {
        skillCache.set(data.botId, data.instructions);
      });
    };

    return { router, socketHandler };
  }
}
