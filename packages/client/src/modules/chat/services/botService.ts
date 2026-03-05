/**
 * 机器人服务 —— 封装所有与 /api/bot 相关的 HTTP 请求
 */
import type { Bot, BotRunMode, LLMConfig, MastraLLMConfig, ProviderInfo, AgentGenerationLog } from '@chat/shared';
import type { MastraProvider } from '@chat/shared';
import { api } from '../../../services/api';

export const botService = {
  /** 创建机器人 */
  async createBot(
    username: string,
    runMode: BotRunMode = 'local',
    _llmConfig?: LLMConfig,
    mastraConfig?: MastraLLMConfig,
  ): Promise<{ bot: Bot }> {
    const res = await api.post<{ bot: Bot }>('/bot/create', {
      username, runMode, mastraConfig,
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

  /** 获取本地 Bot 完整配置（含解密 API Key） */
  async getLocalBotConfig(id: string): Promise<MastraLLMConfig | null> {
    const res = await api.get<{ mastraConfig: MastraLLMConfig | null }>(`/bot/${id}/config`);
    return res.data.mastraConfig;
  },

  /** 更新本地 Bot Mastra 配置 */
  async updateLocalBotConfig(id: string, config: MastraLLMConfig): Promise<{ mastraConfig: MastraLLMConfig }> {
    const res = await api.put<{ mastraConfig: MastraLLMConfig }>(`/bot/${id}/config`, config);
    return res.data;
  },

  /** 获取可用 Mastra providers */
  async getMastraProviders(): Promise<Record<MastraProvider, ProviderInfo>> {
    const res = await api.get<{ providers: Record<MastraProvider, ProviderInfo> }>('/bot/mastra-providers');
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
