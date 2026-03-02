/**
 * Agent 生命周期管理
 *
 * 管理多个 Agent 的启动、停止和轮询循环。
 * 每个 Agent 独立运行：getUpdates → LLM → sendMessage。
 * v1.6.0 新增：自动加载历史、Slash 命令、Markdown 检测。
 */
import { BotClient } from './botClient';
import { callLLM } from './llmClient';
import {
  addMessage,
  getRecentMessages,
  clearHistory,
  hasHistory,
  prefillHistory,
  clearConversationHistory,
} from './conversationHistory';
import type { AgentConfig, AgentState, ChatMessage, LogEntry } from '../shared/types';

interface AgentRunner {
  config: AgentConfig;
  status: 'running' | 'stopped' | 'error';
  abortController: AbortController;
  messagesProcessed: number;
  lastError?: string;
  consecutiveErrors: number;
}

type LogCallback = (entry: LogEntry) => void;
type StatusCallback = (agentId: string, state: AgentState) => void;
type ConfigChangeCallback = (agentId: string, updates: Partial<AgentConfig>) => void;

/** 检测 LLM 回复是否包含 Markdown 格式 */
export function detectMarkdown(text: string): boolean {
  return /^#{1,6}\s/m.test(text) ||
    /```/.test(text) ||
    /\*\*[^*]+\*\*/.test(text) ||
    /^\s*[-*]\s/m.test(text) ||
    /^\|.+\|/m.test(text);
}

/** 解析 Slash 命令，返回 { command, args } 或 null */
export function parseSlashCommand(content: string): { command: string; args: string } | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith('/')) return null;

  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) {
    return { command: trimmed.toLowerCase(), args: '' };
  }
  return {
    command: trimmed.substring(0, spaceIdx).toLowerCase(),
    args: trimmed.substring(spaceIdx + 1).trim(),
  };
}

export class AgentManager {
  private runners = new Map<string, AgentRunner>();

  constructor(
    private onLog: LogCallback,
    private onStatusChange: StatusCallback,
    private onConfigChange?: ConfigChangeCallback,
  ) {}

  /** 启动一个 Agent 的轮询循环 */
  startAgent(config: AgentConfig): void {
    // 如果已经在运行，先停止
    if (this.runners.has(config.id)) {
      this.stopAgent(config.id);
    }

    const abortController = new AbortController();
    const runner: AgentRunner = {
      config,
      status: 'running',
      abortController,
      messagesProcessed: 0,
      consecutiveErrors: 0,
    };

    this.runners.set(config.id, runner);
    this.emitLog(config.id, 'info', `Agent "${config.name}" 已启动`);
    this.emitStatusChange(config.id);

    // 启动异步轮询循环
    this.runLoop(runner).catch((err) => {
      if (runner.status !== 'stopped') {
        runner.status = 'error';
        runner.lastError = err.message;
        this.emitLog(config.id, 'error', `轮询循环异常退出: ${err.message}`);
        this.emitStatusChange(config.id);
      }
    });
  }

  /** 停止指定 Agent */
  stopAgent(id: string): void {
    const runner = this.runners.get(id);
    if (!runner) return;

    runner.status = 'stopped';
    runner.abortController.abort();
    this.runners.delete(id);
    clearHistory(id);
    this.emitLog(id, 'info', `Agent "${runner.config.name}" 已停止`);
    this.emitStatusChange(id);
  }

  /** 停止所有 Agent */
  stopAll(): void {
    for (const id of this.runners.keys()) {
      this.stopAgent(id);
    }
  }

  /** 获取 Agent 运行状态 */
  getStatus(id: string): 'running' | 'stopped' | 'error' {
    return this.runners.get(id)?.status ?? 'stopped';
  }

  /** 获取 Agent 完整状态 */
  getState(id: string): AgentState | null {
    const runner = this.runners.get(id);
    if (!runner) return null;
    return {
      config: runner.config,
      status: runner.status,
      lastError: runner.lastError,
      messagesProcessed: runner.messagesProcessed,
    };
  }

  /** 处理 Slash 命令，返回回复文本；返回 null 表示不是 Slash 命令 */
  private handleSlashCommand(
    runner: AgentRunner,
    command: string,
    args: string,
    conversationId: string,
  ): string | null {
    const { config } = runner;

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
          const oldModel = config.model;
          runner.config = { ...config, model: args };
          this.onConfigChange?.(config.id, { model: args });
          return `模型已从 ${oldModel} 切换为 ${args}`;
        }
        return `当前模型: ${config.provider} / ${config.model}`;

      case '/reset':
        clearConversationHistory(config.id, conversationId);
        return '当前会话历史已清除';

      case '/system':
        if (args) {
          runner.config = { ...config, systemPrompt: args };
          this.onConfigChange?.(config.id, { systemPrompt: args });
          return `系统提示词已更新为: ${args}`;
        }
        return `当前系统提示词: ${config.systemPrompt || '(未设置)'}`;

      default:
        return null;
    }
  }

  /** 核心轮询循环 */
  private async runLoop(runner: AgentRunner): Promise<void> {
    const { config, abortController } = runner;
    const botClient = new BotClient(config.serverUrl, config.botToken);

    while (runner.status === 'running' && !abortController.signal.aborted) {
      try {
        // 1. 长轮询获取消息
        const updates = await botClient.getUpdates(30);

        if (abortController.signal.aborted) break;

        if (updates.length === 0) continue;

        // 2. 逐条处理
        for (const update of updates) {
          if (abortController.signal.aborted) break;

          const { message, conversationId } = update;

          this.emitLog(
            config.id,
            'info',
            `收到消息 [${conversationId.substring(0, 8)}]: ${message.content.substring(0, 50)}`,
          );

          try {
            // 检查是否为 Slash 命令
            const slashCmd = parseSlashCommand(message.content);
            if (slashCmd) {
              const reply = this.handleSlashCommand(runner, slashCmd.command, slashCmd.args, conversationId);
              if (reply !== null) {
                await botClient.sendMessage(conversationId, reply);
                runner.messagesProcessed++;
                runner.consecutiveErrors = 0;
                this.emitLog(config.id, 'info', `Slash 命令回复 [${conversationId.substring(0, 8)}]: ${reply.substring(0, 50)}`);
                this.emitStatusChange(config.id);
                continue;
              }
            }

            // 自动加载历史（首次接触新会话时）
            if (!hasHistory(config.id, conversationId)) {
              try {
                const historyData = await botClient.getHistory(conversationId, runner.config.contextLength * 2);
                if (historyData.messages && historyData.messages.length > 0) {
                  prefillHistory(config.id, conversationId, historyData.messages, historyData.botUserId);
                  this.emitLog(config.id, 'info', `加载会话 [${conversationId.substring(0, 8)}] 历史记录: ${historyData.messages.length} 条`);
                }
              } catch (err: any) {
                this.emitLog(config.id, 'warn', `加载历史失败: ${err.message}`);
              }
            }

            // 添加用户消息到历史
            addMessage(config.id, conversationId, 'user', message.content);

            // 构建 LLM 请求消息
            const recentHistory = getRecentMessages(
              config.id,
              conversationId,
              runner.config.contextLength,
            );

            const messages: ChatMessage[] = [
              { role: 'system', content: runner.config.systemPrompt || 'You are a helpful assistant.' },
              ...recentHistory,
            ];

            // 调用 LLM
            this.emitLog(config.id, 'info', `调用 ${runner.config.provider} (${runner.config.model})...`);
            const reply = await callLLM(runner.config, messages);

            if (abortController.signal.aborted) break;

            // Markdown 检测
            const messageType = detectMarkdown(reply) ? 'markdown' : 'text';

            // 发送回复
            await botClient.sendMessage(conversationId, reply, messageType);

            // 记录回复到历史
            addMessage(config.id, conversationId, 'assistant', reply);

            runner.messagesProcessed++;
            runner.consecutiveErrors = 0;

            this.emitLog(
              config.id,
              'info',
              `已回复 [${conversationId.substring(0, 8)}]: ${reply.substring(0, 50)}`,
            );
            this.emitStatusChange(config.id);
          } catch (err: any) {
            runner.consecutiveErrors++;
            runner.lastError = err.message;
            this.emitLog(config.id, 'error', `处理消息失败: ${err.message}`);
            this.emitStatusChange(config.id);

            // 连续失败 5 次，暂停 agent
            if (runner.consecutiveErrors >= 5) {
              runner.status = 'error';
              this.emitLog(config.id, 'error', '连续失败 5 次，Agent 已暂停');
              this.emitStatusChange(config.id);
              return;
            }

            // 指数退避等待
            const delay = Math.min(1000 * Math.pow(2, runner.consecutiveErrors), 30000);
            await this.sleep(delay, abortController.signal);
          }
        }
      } catch (err: any) {
        if (abortController.signal.aborted) break;

        runner.consecutiveErrors++;
        runner.lastError = err.message;
        this.emitLog(config.id, 'warn', `getUpdates 失败: ${err.message}`);

        if (runner.consecutiveErrors >= 5) {
          runner.status = 'error';
          this.emitLog(config.id, 'error', '连续失败 5 次，Agent 已暂停');
          this.emitStatusChange(config.id);
          return;
        }

        const delay = Math.min(1000 * Math.pow(2, runner.consecutiveErrors), 30000);
        await this.sleep(delay, abortController.signal);
      }
    }
  }

  private emitLog(agentId: string, level: LogEntry['level'], message: string): void {
    this.onLog({
      timestamp: Date.now(),
      agentId,
      level,
      message,
    });
  }

  private emitStatusChange(agentId: string): void {
    const state = this.getState(agentId);
    if (state) {
      this.onStatusChange(agentId, state);
    } else {
      // Agent 已被删除，发送 stopped 状态
      this.onStatusChange(agentId, {
        config: {} as AgentConfig,
        status: 'stopped',
        messagesProcessed: 0,
      });
    }
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
