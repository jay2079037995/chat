/**
 * 服务端机器人运行器
 *
 * 直接使用 Redis BLPOP 监听消息队列，调用 LLM 生成回复。
 * 对话历史持久化到 Redis，服务器重启后不丢失上下文。
 * 移植自 agent-app AgentManager.runLoop，关键区别：
 *  - 直接 Redis BLPOP（不走 HTTP 长轮询）
 *  - 内部调用 BotService（不需要 token）
 *  - 对话历史 Redis 持久化
 */
import Redis from 'ioredis';
import type { Server as SocketIOServer } from 'socket.io';
import type { LLMConfig, ChatMessage, BotStatus } from '@chat/shared';
import type { BotService } from './BotService';
import { callLLM, detectMarkdown } from './LLMClient';
import { config } from '../../config';

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

export class ServerBotRunner {
  private blockingRedis: Redis | null = null;
  private abortController: AbortController | null = null;
  private _status: BotStatus = 'stopped';
  private lastError?: string;
  private messagesProcessed = 0;
  private consecutiveErrors = 0;

  constructor(
    private botId: string,
    private llmConfig: LLMConfig,
    private botService: BotService,
    private io: SocketIOServer | null,
  ) {}

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
      // disconnect 立即关闭连接，中断 BLPOP
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

  /** 核心轮询循环 */
  private async runLoop(): Promise<void> {
    const signal = this.abortController!.signal;

    while (this._status === 'running' && !signal.aborted) {
      try {
        if (!this.blockingRedis) break;

        // BLPOP 等待消息（30 秒超时）
        const result = await this.blockingRedis.blpop(BOT_UPDATES_KEY(this.botId), 30);

        if (signal.aborted || this._status !== 'running') break;
        if (!result) continue;

        // BLPOP 返回 [key, value]
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
            // 从消息记录预填对话历史
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

          // 保存用户消息到对话历史
          await this.botService.saveConvHistory(this.botId, conversationId, {
            role: 'user', content: message.content,
          });

          // 构建 LLM 请求消息
          const recentHistory = await this.botService.getConvHistory(
            this.botId, conversationId, this.llmConfig.contextLength,
          );

          const llmMessages: ChatMessage[] = [
            { role: 'system', content: this.llmConfig.systemPrompt || 'You are a helpful assistant.' },
            ...recentHistory.map((m) => ({
              role: m.role as ChatMessage['role'],
              content: m.content,
            })),
          ];

          // 调用 LLM
          const reply = await callLLM(this.llmConfig, llmMessages);

          if (signal.aborted || this._status !== 'running') break;

          // Markdown 检测
          const messageType = detectMarkdown(reply) ? 'markdown' : 'text';

          // 发送回复
          const savedMsg = await this.botService.sendMessageByBotId(
            this.botId, conversationId, reply, messageType,
          );

          // 保存 assistant 消息到对话历史
          await this.botService.saveConvHistory(this.botId, conversationId, {
            role: 'assistant', content: reply,
          });

          // Socket.IO 广播
          this.broadcastMessage(savedMsg, conversationId);

          this.messagesProcessed++;
          this.consecutiveErrors = 0;
        } catch (err: any) {
          this.consecutiveErrors++;
          this.lastError = err.message;

          // 连续失败 5 次，设为 error 状态
          if (this.consecutiveErrors >= 5) {
            this._status = 'error';
            await this.botService.setBotStatus(this.botId, 'error', '连续失败 5 次');
            return;
          }

          // 指数退避
          const delay = Math.min(1000 * Math.pow(2, this.consecutiveErrors), 30000);
          await this.sleep(delay, signal);
        }
      } catch (err: any) {
        // BLPOP 或外层异常
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
        // 异步清理，不阻塞命令回复
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
    // 房间名与 ChatModule 一致：直接使用 conversationId（无前缀）
    // 事件名与 ChatModule 一致：message:receive
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
