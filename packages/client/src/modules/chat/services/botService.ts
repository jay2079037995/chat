/**
 * 机器人服务 —— 封装所有与 /api/bot 相关的 HTTP 请求
 */
import type { Bot, BotRunMode, BotModelConfig, MastraLLMConfig, ModelProviderInfo, AgentGenerationLog } from '@chat/shared';
import { api } from '../../../services/api';

export const botService = {
  /** 创建机器人（v2.0：优先使用 modelConfig） */
  async createBot(
    username: string,
    runMode: BotRunMode = 'local',
    _llmConfig?: unknown,
    mastraConfig?: MastraLLMConfig,
    modelConfig?: BotModelConfig,
  ): Promise<{ bot: Bot }> {
    const res = await api.post<{ bot: Bot }>('/bot/create', {
      username, runMode, modelConfig, mastraConfig,
    });
    return res.data;
  },

  /** 获取我的机器人列表 */
  async listBots(): Promise<Bot[]> {
    const res = await api.get<{ bots: Bot[] }>('/bot/list');
    return res.data.bots;
  },

  /** 删除机器人 */
  async deleteBot(id: string): Promise<void> {
    await api.delete(`/bot/${id}`);
  },

  /** 获取 Bot 配置（v2.0 modelConfig + 兼容 mastraConfig） */
  async getBotConfig(id: string): Promise<{ modelConfig: BotModelConfig | null; mastraConfig: MastraLLMConfig | null }> {
    const res = await api.get<{ modelConfig: BotModelConfig | null; mastraConfig: MastraLLMConfig | null }>(`/bot/${id}/config`);
    return res.data;
  },

  /** @deprecated 使用 getBotConfig 替代 */
  async getLocalBotConfig(id: string): Promise<MastraLLMConfig | null> {
    const data = await this.getBotConfig(id);
    return data.mastraConfig;
  },

  /** 更新 Bot 模型配置（v2.0） */
  async updateModelConfig(id: string, config: BotModelConfig): Promise<{ modelConfig: BotModelConfig }> {
    const res = await api.put<{ modelConfig: BotModelConfig }>(`/bot/${id}/config`, { modelConfig: config });
    return res.data;
  },

  /** @deprecated 使用 updateModelConfig 替代 */
  async updateLocalBotConfig(id: string, config: MastraLLMConfig): Promise<{ mastraConfig: MastraLLMConfig }> {
    const res = await api.put<{ mastraConfig: MastraLLMConfig }>(`/bot/${id}/config`, { mastraConfig: config });
    return res.data;
  },

  /** 获取可用 Model Providers（v2.0） */
  async getModelProviders(): Promise<Record<string, ModelProviderInfo>> {
    const res = await api.get<{ providers: Record<string, ModelProviderInfo> }>('/bot/model-providers');
    return res.data.providers;
  },

  /** @deprecated 使用 getModelProviders 替代 */
  async getMastraProviders(): Promise<Record<string, { displayName: string; models: string[] }>> {
    const res = await api.get<{ providers: Record<string, { displayName: string; models: string[] }> }>('/bot/mastra-providers');
    return res.data.providers;
  },

  /** 获取 Agent 生成日志 */
  async getGenerationLogs(botId: string, offset: number = 0, limit: number = 20): Promise<{ logs: AgentGenerationLog[]; total: number }> {
    const res = await api.get<{ logs: AgentGenerationLog[]; total: number }>(`/bot/${botId}/generation-logs`, {
      params: { offset, limit },
    });
    return res.data;
  },

  /** 清空 Agent 生成日志 */
  async clearGenerationLogs(botId: string): Promise<void> {
    await api.delete(`/bot/${botId}/generation-logs`);
  },
};
