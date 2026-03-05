import { Router } from 'express';
import type { ServerModule, ModuleContext, ModuleRegistration, TypedIO } from '../../core/types';
import { TOKENS } from '../../core/tokens';
import type { IUserRepository } from '../../repositories/interfaces/IUserRepository';
import type { ISessionRepository } from '../../repositories/interfaces/ISessionRepository';
import type { IMessageRepository } from '../../repositories/interfaces/IMessageRepository';
import type { MastraLLMConfig, BotModelConfig, Message, MessageMetadata, AgentStepLog, AgentGenerationLog } from '@chat/shared';
import { MASTRA_PROVIDERS, MODEL_PROVIDERS, generateId } from '@chat/shared';
import { parseModelString, isReasonerModel } from './ModelFactory';
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

        const { modelConfig, mastraConfig } = req.body;
        if (!modelConfig && !mastraConfig) {
          res.status(400).json({ error: '需要提供模型配置' });
          return;
        }

        const result = await botService.createBot(req.userId!, username.trim(), 'local', undefined, mastraConfig, modelConfig);

        const maskedModelConfig = await botService.getModelConfigMasked(result.id);
        const maskedMastraConfig = await botService.getMastraConfigMasked(result.id);

        res.json({
          bot: {
            id: result.id,
            username: result.username,
            ownerId: result.botOwnerId!,
            createdAt: result.createdAt,
            runMode: 'local',
            modelConfig: maskedModelConfig,
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
        if (error.message === 'LOCAL_MODE_REQUIRES_MODEL_CONFIG') {
          res.status(400).json({ error: '需要提供模型配置' });
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
            const modelConfig = await botService.getModelConfigMasked(b.id);
            const mastraConfig = await botService.getMastraConfigMasked(b.id);
            return {
              id: b.id,
              username: b.username,
              ownerId: b.botOwnerId!,
              createdAt: b.createdAt,
              runMode: 'local' as const,
              modelConfig,
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

        const modelConfig = await botService.getModelConfigMasked(botId);
        const mastraConfig = await botService.getMastraConfigMasked(botId);
        res.json({ modelConfig, mastraConfig });
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

        const { modelConfig: mc, mastraConfig: legacy } = req.body;
        // 优先处理新格式 modelConfig
        if (mc) {
          const modelConfig = mc as BotModelConfig;
          if (!modelConfig.model) {
            res.status(400).json({ error: '缺少必要的模型配置字段 (model)' });
            return;
          }
          // 如果 apiKey 是脱敏值，保留原始值
          if (modelConfig.apiKey && modelConfig.apiKey.includes('****')) {
            const existing = await botService.getModelConfig(botId);
            if (existing) {
              modelConfig.apiKey = existing.apiKey;
            }
          }
          await botService.saveModelConfig(botId, modelConfig);
          const masked = await botService.getModelConfigMasked(botId);
          res.json({ modelConfig: masked });
        } else if (legacy) {
          // 兼容旧格式
          const mastraConfig = legacy as MastraLLMConfig;
          if (!mastraConfig.provider || !mastraConfig.apiKey || !mastraConfig.model) {
            res.status(400).json({ error: '缺少必要的 Mastra 配置字段' });
            return;
          }
          if (mastraConfig.apiKey.includes('****')) {
            const existing = await botService.getMastraConfig(botId);
            if (existing) {
              mastraConfig.apiKey = existing.apiKey;
            }
          }
          await botService.saveMastraConfig(botId, mastraConfig);
          const masked = await botService.getMastraConfigMasked(botId);
          res.json({ mastraConfig: masked });
        } else {
          res.status(400).json({ error: '缺少配置数据 (modelConfig 或 mastraConfig)' });
        }
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

        // 加载 bot 配置（优先新格式，自动 fallback 旧格式）
        const modelCfg = await botService.getModelConfig(botId);
        if (!modelCfg) {
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
        const basePrompt = modelCfg.systemPrompt || '';
        // 如果无 Skill 推送，补充基础工具说明
        const toolInstructions = !skillInstructions
          ? '\n\n# 工作区环境\n\n你拥有一个专属的工作目录。\n\n## 工具使用说明\n\n你可以使用以下工具来执行任务：\n\n- `bash_exec`: 执行 Shell 命令。命令在工作区目录中运行，无需 cd。\n- `read_file`: 读取文件。相对路径基于工作区目录解析。\n- `write_file`: 写入文件。相对路径基于工作区目录解析。只能写入工作区内的文件。\n- `list_files`: 列出目录。默认列出工作区根目录。\n- `present_choices`: 向用户展示可点击的选项按钮或请求文本输入。\n\n**重要**: 所有相对路径都基于工作区目录解析，bash_exec 的工作目录已设为工作区，直接运行命令即可。'
          : '';
        // v2.3.0: 自我赋能决策流程
        const selfEmpowermentPrompt = `

# 自我赋能

当用户的需求超出你当前的能力范围时，按以下流程自主扩展能力：

1. **评估需求** — 判断是否需要额外的 Skill
2. **搜索 Skill** — 使用 \`search_skills\` 搜索 claude-plugins.dev
3. **确认安装** — 使用 \`present_choices\` 向用户确认是否安装
4. **安装 Skill** — 使用 \`install_skill\` 安装
5. **读取指令** — 使用 \`read_skill\` 加载完整指令
6. **执行任务** — 按照 Skill 指令完成用户需求

你也可以使用 \`list_models\` 查看可用模型，使用 \`switch_model\` 切换到更适合当前任务的模型。`;

        const systemPrompt = basePrompt + (skillInstructions ? '\n\n' + skillInstructions : '') + toolInstructions + selfEmpowermentPrompt;

        // 创建 model + tools + 步骤日志收集
        const model = await createModel(modelCfg);
        let pendingMetadata: MessageMetadata | undefined;
        const targetUserId = bot.botOwnerId || '';
        // 推理模型不支持 function calling
        const isReasoner = isReasonerModel(modelCfg.model);
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
        // v2.3.0: 动态模型切换（switch_model 工具更新此引用，下次 /chat 请求生效）
        let currentModelStr = modelCfg.model;
        const tools = !isReasoner && targetUserId && toolDispatcher ? createServerTools({
          dispatcher: toolDispatcher,
          targetUserId,
          botId,
          conversationId,
          onPresentChoices: (m) => { pendingMetadata = m; },
          onFileArtifact: (a) => { pendingFileArtifacts.push(a); },
          onStepProgress: (data) => emitProgress(data),
          onSwitchModel: (model) => {
            currentModelStr = model;
            console.log(`[BotChat] Model switched to: ${model} (effective next turn)`);
          },
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
              toolOutputLength: log.outputLength,
              error: log.error,
              durationMs: log.durationMs,
              // workspacePath 由 Electron 侧日志记录
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
        console.log('[BotChat] Starting stream for bot:', botId, 'model:', modelCfg.model);
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
            provider: parseModelString(modelCfg.model).provider,
            model: parseModelString(modelCfg.model).modelId,
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

    // GET /api/bot/model-providers — 获取可用 Model Provider 及模型列表（v2.0）
    router.get('/model-providers', (_req, res) => {
      res.json({ providers: MODEL_PROVIDERS });
    });

    // GET /api/bot/mastra-providers — 兼容旧客户端
    /** @deprecated 使用 /model-providers 替代 */
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
