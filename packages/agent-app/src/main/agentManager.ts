/**
 * Agent 生命周期管理
 *
 * 管理多个 Agent 的启动、停止和轮询循环。
 * 每个 Agent 独立运行：getUpdates → LLM → sendMessage。
 */
import { BotClient } from './botClient';
import { callLLM } from './llmClient';
import { addMessage, getRecentMessages, clearHistory } from './conversationHistory';
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

export class AgentManager {
  private runners = new Map<string, AgentRunner>();

  constructor(
    private onLog: LogCallback,
    private onStatusChange: StatusCallback,
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
            // 添加用户消息到历史
            addMessage(config.id, conversationId, 'user', message.content);

            // 构建 LLM 请求消息
            const recentHistory = getRecentMessages(
              config.id,
              conversationId,
              config.contextLength,
            );

            const messages: ChatMessage[] = [
              { role: 'system', content: config.systemPrompt || 'You are a helpful assistant.' },
              ...recentHistory,
            ];

            // 调用 LLM
            this.emitLog(config.id, 'info', `调用 ${config.provider} (${config.model})...`);
            const reply = await callLLM(config, messages);

            if (abortController.signal.aborted) break;

            // 发送回复
            await botClient.sendMessage(conversationId, reply);

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
