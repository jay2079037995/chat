/**
 * 本地 Bot 管理器
 *
 * 在 Electron 主进程中管理 Mastra Agent 实例。
 * 每个本地 Bot 对应一个 Agent，支持流式输出。
 */
import { Agent } from '@mastra/core/agent';
import { getMastraTools } from './MastraToolBridge';

/** Mastra AI SDK 提供商（与 @chat/shared MastraProvider 一致） */
type MastraProvider = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'qwen';

/** Mastra LLM 配置（与 @chat/shared MastraLLMConfig 一致） */
interface MastraLLMConfig {
  provider: MastraProvider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  contextLength: number;
  enabledTools?: string[];
}

/** 流式事件回调 */
export interface StreamCallbacks {
  onChunk: (data: { botId: string; conversationId: string; messageId: string; chunk: string }) => void;
  onEnd: (data: { botId: string; conversationId: string; messageId: string; fullContent: string; messageType: string }) => void;
  onError: (data: { botId: string; conversationId: string; error: string }) => void;
}

/** 会话消息 */
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class LocalBotManager {
  /** botId → Mastra Agent */
  private agents = new Map<string, Agent>();
  /** botId → MastraLLMConfig */
  private configs = new Map<string, MastraLLMConfig>();
  /** botId → convId → messages */
  private histories = new Map<string, Map<string, ConversationMessage[]>>();
  /** 流式回调 */
  private callbacks: StreamCallbacks | null = null;

  /** 设置流式回调（由 main.ts 注册） */
  setCallbacks(callbacks: StreamCallbacks): void {
    this.callbacks = callbacks;
  }

  /** 根据 provider 创建 AI SDK model */
  private async getModel(provider: MastraProvider, model: string, apiKey: string) {
    switch (provider) {
      case 'openai': {
        const { createOpenAI } = await import('@ai-sdk/openai');
        return createOpenAI({ apiKey })(model);
      }
      case 'anthropic': {
        const { createAnthropic } = await import('@ai-sdk/anthropic');
        return createAnthropic({ apiKey })(model);
      }
      case 'google': {
        const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
        return createGoogleGenerativeAI({ apiKey })(model);
      }
      case 'deepseek': {
        const { createOpenAI } = await import('@ai-sdk/openai');
        return createOpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' })(model);
      }
      case 'qwen': {
        const { createOpenAI } = await import('@ai-sdk/openai');
        return createOpenAI({ apiKey, baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' })(model);
      }
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /** 初始化一个本地 Bot */
  async initBot(botId: string, config: MastraLLMConfig): Promise<void> {
    // 先清理已有的
    this.removeBot(botId);

    const model = await this.getModel(config.provider, config.model, config.apiKey);
    const tools = getMastraTools(config.enabledTools);

    const agent = new Agent({
      name: `local-bot-${botId}`,
      instructions: config.systemPrompt || '你是一个有用的助手。',
      model,
      tools,
    });

    this.agents.set(botId, agent);
    this.configs.set(botId, config);
    this.histories.set(botId, new Map());

    console.log(`[LocalBot] Initialized bot ${botId} with ${config.provider}/${config.model}`);
  }

  /** 移除一个本地 Bot */
  removeBot(botId: string): void {
    this.agents.delete(botId);
    this.configs.delete(botId);
    this.histories.delete(botId);
  }

  /** 处理收到的消息（流式输出） */
  async handleMessage(botId: string, conversationId: string, messageContent: string): Promise<void> {
    const agent = this.agents.get(botId);
    if (!agent) {
      this.callbacks?.onError({ botId, conversationId, error: 'Bot 未初始化' });
      return;
    }

    const config = this.configs.get(botId)!;
    const messageId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 获取或创建会话历史
    let convHistories = this.histories.get(botId);
    if (!convHistories) {
      convHistories = new Map();
      this.histories.set(botId, convHistories);
    }
    let history = convHistories.get(conversationId) || [];

    // 添加用户消息到历史
    history.push({ role: 'user', content: messageContent });

    // 截断历史以适应上下文长度（粗略估计，每字符约 1 token）
    const maxHistoryChars = (config.contextLength || 4096) * 3;
    let totalChars = history.reduce((sum, m) => sum + m.content.length, 0);
    while (totalChars > maxHistoryChars && history.length > 1) {
      const removed = history.shift()!;
      totalChars -= removed.content.length;
    }

    try {
      const messages = history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      const stream = await agent.stream(messages, { maxSteps: 5 });

      let fullContent = '';
      for await (const chunk of stream.textStream) {
        fullContent += chunk;
        this.callbacks?.onChunk({ botId, conversationId, messageId, chunk });
      }

      // 添加 assistant 回复到历史
      history.push({ role: 'assistant', content: fullContent });
      convHistories.set(conversationId, history);

      // 检测消息类型
      const messageType = detectMarkdown(fullContent) ? 'markdown' : 'text';
      this.callbacks?.onEnd({ botId, conversationId, messageId, fullContent, messageType });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[LocalBot] Error processing message for ${botId}:`, errorMsg);
      this.callbacks?.onError({ botId, conversationId, error: errorMsg });
    }
  }

  /** 获取已初始化的 bot 列表 */
  getActiveBots(): string[] {
    return Array.from(this.agents.keys());
  }

  /** 检查 bot 是否已初始化 */
  isActive(botId: string): boolean {
    return this.agents.has(botId);
  }

  /** 获取 bot 的 LLM 配置（用于重建 Agent） */
  getConfig(botId: string): MastraLLMConfig | undefined {
    return this.configs.get(botId);
  }
}

/** 简单的 Markdown 检测 */
function detectMarkdown(text: string): boolean {
  const mdPatterns = [/^#{1,6}\s/m, /```[\s\S]*?```/, /\*\*[^*]+\*\*/, /^\s*[-*]\s/m, /^\s*\d+\.\s/m, /\[.+\]\(.+\)/];
  return mdPatterns.some((p) => p.test(text));
}
