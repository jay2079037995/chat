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
import type { LLMConfig, ChatMessage, BotStatus, LLMTool, LLMCallLog } from '@chat/shared';
import { generateId } from '@chat/shared';
import type { BotService } from './BotService';
import type { SkillRegistry } from '../skill/SkillRegistry';
import type { SkillDispatcher } from './SkillDispatcher';
import { callLLM, callLLMWithTools, detectMarkdown } from './LLMClient';
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

export class ServerBotRunner {
  private blockingRedis: Redis | null = null;
  private abortController: AbortController | null = null;
  private _status: BotStatus = 'stopped';
  private lastError?: string;
  private messagesProcessed = 0;
  private consecutiveErrors = 0;

  /** Bot 允许使用的 Skill 函数名列表（['*'] 或空数组表示全部） */
  private allowedSkills?: string[];

  constructor(
    private botId: string,
    private llmConfig: LLMConfig,
    private botService: BotService,
    private io: SocketIOServer | null,
    private skillRegistry?: SkillRegistry,
    private skillDispatcher?: SkillDispatcher,
    allowedSkills?: string[],
  ) {
    this.allowedSkills = allowedSkills;
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

  /** 热更新允许的 Skill 列表 */
  updateAllowedSkills(skills: string[]): void {
    this.allowedSkills = skills;
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

          // 推理模型不支持 function calling，跳过 tools
          const isReasoner = this.llmConfig.model === 'deepseek-reasoner';
          // 将 Skill 名称列表解析为 function 名称列表（白名单）
          let allowedFunctions: string[] | undefined;
          if (this.allowedSkills && !this.allowedSkills.includes('*') && this.allowedSkills.length > 0 && this.skillRegistry) {
            allowedFunctions = [];
            for (const skillName of this.allowedSkills) {
              const skill = this.skillRegistry.getSkill(skillName);
              if (skill) {
                for (const action of skill.actions) {
                  allowedFunctions.push(action.functionName);
                }
              }
            }
          }
          const tools: LLMTool[] | undefined = (!isReasoner && this.skillRegistry)
            ? this.skillRegistry.generateTools({ platform: 'mac', allowedFunctions })
            : undefined;
          const hasTools = tools && tools.length > 0;

          let reply: string;

          if (hasTools && this.skillDispatcher) {
            // 带 function calling 的调用循环
            reply = await this.runToolCallingLoop(
              llmMessages, tools, conversationId, message.senderId, signal,
            );
          } else {
            // 无 Skill 支持，直接文本调用（向后兼容）
            const startTime = Date.now();
            try {
              reply = await callLLM(this.llmConfig, llmMessages);
              await this.saveLLMLog(conversationId, llmMessages, undefined, {
                content: reply, finishReason: 'stop',
              }, undefined, Date.now() - startTime);
            } catch (llmErr: any) {
              await this.saveLLMLog(conversationId, llmMessages, undefined, undefined, llmErr.message, Date.now() - startTime);
              throw llmErr;
            }
          }

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

  /**
   * 带 function calling 的 LLM 调用循环
   *
   * 流程：调用 LLM → 如果返回 tool_calls → 分发到 Electron 执行 →
   * 将结果反馈给 LLM → 重复直到 LLM 返回文本回复或达到最大轮次。
   */
  private async runToolCallingLoop(
    messages: ChatMessage[],
    tools: LLMTool[],
    conversationId: string,
    targetUserId: string,
    signal: AbortSignal,
  ): Promise<string> {
    let round = 0;
    // 工作副本，追加 tool 交互消息
    const workMessages = [...messages];

    while (round < MAX_TOOL_ROUNDS) {
      if (signal.aborted || this._status !== 'running') {
        return '（已中断）';
      }

      const startTime = Date.now();
      let result: import('./LLMClient').LLMCallResult;
      try {
        result = await callLLMWithTools(this.llmConfig, workMessages, tools);
        await this.saveLLMLog(conversationId, workMessages, tools, {
          content: result.content, toolCalls: result.toolCalls,
          finishReason: result.finishReason, reasoningContent: result.reasoningContent,
        }, undefined, Date.now() - startTime, round);
      } catch (llmErr: any) {
        await this.saveLLMLog(conversationId, workMessages, tools, undefined, llmErr.message, Date.now() - startTime, round);
        throw llmErr;
      }

      if (!result.hasToolCalls || !result.toolCalls) {
        // LLM 返回了最终文本回复
        return result.content || '（无回复内容）';
      }

      // 将 assistant 消息（含 tool_calls）追加到对话
      workMessages.push({
        role: 'assistant',
        content: result.content || '',
        tool_calls: result.toolCalls,
      });

      // 逐个分发 tool_call 到 Electron 端执行
      for (const toolCall of result.toolCalls) {
        let params: Record<string, unknown> = {};
        try {
          params = JSON.parse(toolCall.function.arguments);
        } catch {
          // 参数解析失败
        }

        const execResult = await this.skillDispatcher!.dispatch(
          targetUserId,
          toolCall.function.name,
          params,
          this.botId,
          conversationId,
        );

        // 将 tool 执行结果追加到对话
        const resultContent = execResult.success
          ? JSON.stringify(execResult.data ?? '操作成功')
          : `错误: ${execResult.error || '未知错误'}`;

        workMessages.push({
          role: 'tool',
          content: resultContent,
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
        });
      }

      round++;
    }

    // 达到最大轮次，做最后一次不带 tools 的调用让 LLM 总结
    const finalStart = Date.now();
    try {
      const finalResult = await callLLMWithTools(this.llmConfig, workMessages);
      await this.saveLLMLog(conversationId, workMessages, undefined, {
        content: finalResult.content, finishReason: finalResult.finishReason,
      }, undefined, Date.now() - finalStart, round);
      return finalResult.content || '（已完成所有操作）';
    } catch (llmErr: any) {
      await this.saveLLMLog(conversationId, workMessages, undefined, undefined, llmErr.message, Date.now() - finalStart, round);
      throw llmErr;
    }
  }

  /** 保存 LLM 调用日志（失败不影响主流程） */
  private async saveLLMLog(
    conversationId: string,
    messages: ChatMessage[],
    tools: LLMTool[] | undefined,
    response: LLMCallLog['response'] | undefined,
    error: string | undefined,
    durationMs: number,
    toolRound?: number,
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
          // 截断每条 message.content 到 2000 字符
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content.length > 2000 ? m.content.slice(0, 2000) + '…' : m.content,
          })),
          tools: tools?.map((t) => ({
            name: t.function.name,
            description: t.function.description,
          })),
        },
        response,
        error,
        durationMs,
        toolRound,
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
