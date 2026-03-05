/**
 * 服务端机器人运行器
 *
 * 直接使用 Redis BLPOP 监听消息队列，调用 Mastra Agent.generate() 生成回复。
 * 对话历史持久化到 Redis，服务器重启后不丢失上下文。
 * 通用工具（bash_exec/read_file/write_file/list_files）通过
 * ToolDispatcher 分发到 Electron 端执行（由 Mastra maxSteps 自动循环）。
 * Skill 指令通过 skillInstructions 注入到系统提示词。
 */
import Redis from 'ioredis';
import type { Server as SocketIOServer } from 'socket.io';
import { Agent } from '@mastra/core/agent';
import type { LLMConfig, ChatMessage, BotStatus, LLMCallLog, MessageMetadata } from '@chat/shared';
import { generateId } from '@chat/shared';
import type { BotService } from './BotService';
import type { ToolDispatcher } from './ToolDispatcher';
import { createModel } from './ModelFactory';
import { createServerTools, type FileArtifact } from './ServerToolBridge';
import { saveBase64File } from '../chat/upload';
import { config } from '../../config';

/** 最大 tool calling 轮次，防止无限循环 */
const MAX_TOOL_ROUNDS = 5;

const BOT_UPDATES_KEY = (botId: string) => `bot_updates:${botId}`;

/** Slash 命令解析 */
function parseSlashCommand(content: string): { command: string; args: string } | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith('/')) return null;
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) return { command: trimmed.toLowerCase(), args: '' };
  return {
    command: trimmed.substring(0, spaceIdx).toLowerCase(),
    args: trimmed.substring(spaceIdx + 1).trim(),
  };
}

/** 简单的 Markdown 检测 */
function detectMarkdown(text: string): boolean {
  const mdPatterns = [/^#{1,6}\s/m, /```[\s\S]*?```/, /\*\*[^*]+\*\*/, /^\s*[-*]\s/m, /^\s*\d+\.\s/m, /\[.+\]\(.+\)/];
  return mdPatterns.some((p) => p.test(text));
}

export class ServerBotRunner {
  private blockingRedis: Redis | null = null;
  private abortController: AbortController | null = null;
  private _status: BotStatus = 'stopped';
  private lastError?: string;
  private messagesProcessed = 0;
  private consecutiveErrors = 0;

  /** Skill 指令文本（由 Electron 推送，注入到系统提示词） */
  skillInstructions = '';

  constructor(
    private botId: string,
    private llmConfig: LLMConfig,
    private botService: BotService,
    private io: SocketIOServer | null,
    private toolDispatcher?: ToolDispatcher,
    /** Bot owner 的 userId，用于工具分发到 Electron */
    private targetUserId?: string,
  ) {}

  /** 设置 Skill 指令（由 ServerBotManager 在 Electron 推送时调用） */
  setSkillInstructions(instructions: string): void {
    this.skillInstructions = instructions;
  }

  /** 设置 Bot owner userId（用于工具分发） */
  setTargetUserId(userId: string): void {
    this.targetUserId = userId;
  }

  /** 启动轮询 */
  async start(): Promise<void> {
    if (this._status === 'running') return;

    this.abortController = new AbortController();
    this.consecutiveErrors = 0;

    // 创建独立 Redis 连接用于 BLPOP
    this.blockingRedis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
    });

    this._status = 'running';
    await this.botService.setBotStatus(this.botId, 'running');

    // 启动异步轮询
    this.runLoop().catch(async (err) => {
      if (this._status !== 'stopped') {
        this._status = 'error';
        this.lastError = err.message;
        await this.botService.setBotStatus(this.botId, 'error', err.message);
      }
    });
  }

  /** 停止轮询 */
  async stop(): Promise<void> {
    this._status = 'stopped';
    this.abortController?.abort();
    this.abortController = null;

    if (this.blockingRedis) {
      this.blockingRedis.disconnect();
      this.blockingRedis = null;
    }

    await this.botService.setBotStatus(this.botId, 'stopped');
  }

  /** 热更新 LLM 配置 */
  updateConfig(partial: Partial<LLMConfig>): void {
    this.llmConfig = { ...this.llmConfig, ...partial };
  }

  /** 获取运行状态 */
  getStatus(): { status: BotStatus; lastError?: string; messagesProcessed: number } {
    return {
      status: this._status,
      lastError: this.lastError,
      messagesProcessed: this.messagesProcessed,
    };
  }

  /** 构建包含 Skill 指令的系统提示词 */
  private buildSystemPrompt(): string {
    const base = this.llmConfig.systemPrompt || 'You are a helpful assistant.';
    if (!this.skillInstructions) return base;
    return base + this.skillInstructions;
  }

  /** 核心轮询循环 */
  private async runLoop(): Promise<void> {
    const signal = this.abortController!.signal;

    while (this._status === 'running' && !signal.aborted) {
      try {
        if (!this.blockingRedis) break;

        const result = await this.blockingRedis.blpop(BOT_UPDATES_KEY(this.botId), 30);

        if (signal.aborted || this._status !== 'running') break;
        if (!result) continue;

        const update = JSON.parse(result[1]);
        const { message, conversationId } = update;

        try {
          // 处理 Slash 命令
          const slashCmd = parseSlashCommand(message.content);
          if (slashCmd) {
            const reply = this.handleSlashCommand(slashCmd.command, slashCmd.args, conversationId);
            if (reply !== null) {
              const savedMsg = await this.botService.sendMessageByBotId(
                this.botId, conversationId, reply,
              );
              this.broadcastMessage(savedMsg, conversationId);
              this.messagesProcessed++;
              this.consecutiveErrors = 0;
              continue;
            }
          }

          // 首次接触会话：从 Redis 对话历史加载，若无则从消息记录预填
          const convHistory = await this.botService.getConvHistory(
            this.botId, conversationId,
          );

          if (convHistory.length === 0) {
            try {
              const historyData = await this.botService.getHistoryByBotId(
                this.botId, conversationId, this.llmConfig.contextLength * 2,
              );
              for (const msg of historyData.messages) {
                const role = msg.senderId === this.botId ? 'assistant' : 'user';
                await this.botService.saveConvHistory(this.botId, conversationId, {
                  role, content: msg.content,
                });
              }
            } catch {
              // 历史加载失败不影响正常处理
            }
          }

          await this.botService.saveConvHistory(this.botId, conversationId, {
            role: 'user', content: message.content,
          });

          const recentHistory = await this.botService.getConvHistory(
            this.botId, conversationId, this.llmConfig.contextLength,
          );

          // 调用 AI SDK 生成回复
          const { content: reply, metadata: replyMetadata, fileArtifacts } = await this.runAIGenerate(
            conversationId, recentHistory, message.senderId,
          );

          if (signal.aborted || this._status !== 'running') break;

          const messageType = detectMarkdown(reply) ? 'markdown' : 'text';

          const savedMsg = await this.botService.sendMessageByBotId(
            this.botId, conversationId, reply, messageType, replyMetadata,
          );

          await this.botService.saveConvHistory(this.botId, conversationId, {
            role: 'assistant', content: reply,
          });

          this.broadcastMessage(savedMsg, conversationId);

          // 发送文件产物到聊天
          for (const artifact of fileArtifacts) {
            try {
              const { url } = saveBase64File(artifact.base64, artifact.fileName, artifact.mimeType);
              const isImage = artifact.mimeType.startsWith('image/');
              const fileMsg = await this.botService.sendFileMessageByBotId(
                this.botId, conversationId, url,
                isImage ? 'image' : 'file',
                artifact.fileName, artifact.fileSize, artifact.mimeType,
              );
              this.broadcastMessage(fileMsg, conversationId);
            } catch (fileErr: any) {
              console.error(`[ServerBotRunner] 文件产物发送失败: ${fileErr.message}`);
            }
          }

          this.messagesProcessed++;
          this.consecutiveErrors = 0;
        } catch (err: any) {
          console.error(`[ServerBotRunner] 消息处理失败 (bot: ${this.botId}):`, err.message || err);
          this.consecutiveErrors++;
          this.lastError = err.message;

          if (this.consecutiveErrors >= 5) {
            this._status = 'error';
            await this.botService.setBotStatus(this.botId, 'error', '连续失败 5 次');
            return;
          }

          const delay = Math.min(1000 * Math.pow(2, this.consecutiveErrors), 30000);
          await this.sleep(delay, signal);
        }
      } catch (err: any) {
        if (signal.aborted || this._status !== 'running') break;

        this.consecutiveErrors++;
        this.lastError = err.message;

        if (this.consecutiveErrors >= 5) {
          this._status = 'error';
          await this.botService.setBotStatus(this.botId, 'error', '连续失败 5 次');
          return;
        }

        const delay = Math.min(1000 * Math.pow(2, this.consecutiveErrors), 30000);
        await this.sleep(delay, signal);
      }
    }
  }

  /**
   * 使用 Mastra Agent.generate() 生成回复
   *
   * maxSteps 参数让 Mastra 自动处理 tool calling 循环。
   */
  private async runAIGenerate(
    conversationId: string,
    history: Array<{ role: string; content: string }>,
    fallbackTargetUserId: string,
  ): Promise<{ content: string; metadata?: MessageMetadata; fileArtifacts: FileArtifact[] }> {
    let pendingMetadata: MessageMetadata | undefined;
    const pendingFileArtifacts: FileArtifact[] = [];

    const startTime = Date.now();

    try {
      const model = await createModel(this.llmConfig);
      const systemPrompt = this.buildSystemPrompt();

      // 推理模型不支持 function calling
      const isReasoner = this.llmConfig.model === 'deepseek-reasoner';
      const useTools = !isReasoner && this.toolDispatcher;

      const tools = useTools
        ? createServerTools({
            dispatcher: this.toolDispatcher!,
            targetUserId: this.targetUserId || fallbackTargetUserId,
            botId: this.botId,
            conversationId,
            onPresentChoices: (m) => { pendingMetadata = m; },
            onFileArtifact: (a) => { pendingFileArtifacts.push(a); },
          })
        : undefined;

      const agent = new Agent({
        id: `server-bot-${this.botId}`,
        name: `server-bot-${this.botId}`,
        instructions: systemPrompt,
        model,
        tools,
      });

      console.log(`[ServerBotRunner] 开始生成 (bot: ${this.botId}, model: ${this.llmConfig.model}, tools: ${useTools ? 'yes' : 'no'}, history: ${history.length} msgs)`);
      const result = await agent.generateLegacy(
        history.map((m) => ({
          role: m.role,
          content: m.content,
        })) as any,
        { maxSteps: useTools ? MAX_TOOL_ROUNDS : 1 },
      );
      console.log(`[ServerBotRunner] 生成完成 (bot: ${this.botId}, text length: ${result.text?.length || 0}, finishReason: ${result.finishReason})`);

      const content = result.text || '（无回复内容）';

      // 保存 LLM 调用日志
      await this.saveLLMLog(conversationId, history, !!tools, {
        content,
        finishReason: result.finishReason || 'stop',
      }, undefined, Date.now() - startTime);

      return { content, metadata: pendingMetadata, fileArtifacts: pendingFileArtifacts };
    } catch (err: any) {
      await this.saveLLMLog(conversationId, history, false, undefined, err.message, Date.now() - startTime);
      throw err;
    }
  }

  /** 保存 LLM 调用日志 */
  private async saveLLMLog(
    conversationId: string,
    messages: Array<{ role: string; content: string }>,
    hasTools: boolean,
    response: LLMCallLog['response'] | undefined,
    error: string | undefined,
    durationMs: number,
  ): Promise<void> {
    try {
      const log: LLMCallLog = {
        id: generateId(),
        botId: this.botId,
        timestamp: Date.now(),
        conversationId,
        request: {
          provider: this.llmConfig.provider,
          model: this.llmConfig.model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content.length > 2000 ? m.content.slice(0, 2000) + '…' : m.content,
          })),
          tools: hasTools ? [
            { name: 'bash_exec', description: 'Shell 命令' },
            { name: 'read_file', description: '读取文件' },
            { name: 'write_file', description: '写入文件' },
            { name: 'list_files', description: '列出文件' },
            { name: 'send_file_to_chat', description: '发送文件到聊天' },
            { name: 'present_choices', description: '展示选项' },
          ] : undefined,
        },
        response,
        error,
        durationMs,
      };
      await this.botService.saveLLMCallLog(log);
    } catch {
      // 日志保存失败不影响主流程
    }
  }

  /** 处理 Slash 命令 */
  private handleSlashCommand(command: string, args: string, conversationId: string): string | null {
    switch (command) {
      case '/help':
        return [
          '可用命令:',
          '/help — 显示此帮助信息',
          '/model — 查看当前模型',
          '/model <name> — 切换模型',
          '/reset — 清除当前会话历史',
          '/system — 查看当前系统提示词',
          '/system <text> — 设置新的系统提示词',
        ].join('\n');

      case '/model':
        if (args) {
          const oldModel = this.llmConfig.model;
          this.llmConfig = { ...this.llmConfig, model: args };
          return `模型已从 ${oldModel} 切换为 ${args}`;
        }
        return `当前模型: ${this.llmConfig.provider} / ${this.llmConfig.model}`;

      case '/reset':
        void this.botService.clearConvHistory(this.botId, conversationId);
        return '当前会话历史已清除';

      case '/system':
        if (args) {
          this.llmConfig = { ...this.llmConfig, systemPrompt: args };
          return `系统提示词已更新为: ${args}`;
        }
        return `当前系统提示词: ${this.llmConfig.systemPrompt || '(未设置)'}`;

      default:
        return null;
    }
  }

  /** Socket.IO 广播消息 */
  private broadcastMessage(message: any, conversationId: string): void {
    if (!this.io) return;
    this.io.to(conversationId).emit('message:receive', message);
  }

  private sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }
}
