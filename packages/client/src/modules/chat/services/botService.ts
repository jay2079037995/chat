/**
 * 机器人服务 —— 封装所有与 /api/bot 相关的 HTTP 请求
 */
import type { Bot, BotRunMode, LLMConfig, MastraLLMConfig, ProviderInfo, LLMProvider, LLMCallLog } from '@chat/shared';
import type { MastraProvider } from '@chat/shared';
import { api } from '../../../services/api';

export const botService = {
  /** 创建机器人 */
  async createBot(
    username: string,
    runMode: BotRunMode = 'client',
    llmConfig?: LLMConfig,
    mastraConfig?: MastraLLMConfig,
  ): Promise<{ bot: Bot; token?: string }> {
    const res = await api.post<{ bot: Bot; token?: string }>('/bot/create', {
      username, runMode, llmConfig, mastraConfig,
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

  /** 更新服务端 Bot LLM 配置 */
  async updateBotConfig(id: string, llmConfig: LLMConfig): Promise<{ llmConfig: LLMConfig }> {
    const res = await api.put<{ llmConfig: LLMConfig }>(`/bot/${id}/config`, llmConfig);
    return res.data;
  },

  /** 启动服务端 Bot */
  async startBot(id: string): Promise<void> {
    await api.post(`/bot/${id}/start`);
  },

  /** 停止服务端 Bot */
  async stopBot(id: string): Promise<void> {
    await api.post(`/bot/${id}/stop`);
  },

  /** 获取可用 LLM providers */
  async getProviders(): Promise<Record<LLMProvider, ProviderInfo>> {
    const res = await api.get<{ providers: Record<LLMProvider, ProviderInfo> }>('/bot/providers');
    return res.data.providers;
  },

  /** 获取所有可用 Skill 列表 */
  async getAvailableSkills(): Promise<Array<{ name: string; displayName: string; description: string }>> {
    const res = await api.get<{ skills: Array<{ name: string; displayName: string; description: string }> }>('/skill/list');
    return res.data.skills;
  },

  /** 设置 Bot 允许的 Skill 列表 */
  async setBotSkills(botId: string, skills: string[]): Promise<{ allowedSkills: string[] }> {
    const res = await api.put<{ allowedSkills: string[] }>(`/bot/${botId}/skills`, { skills });
    return res.data;
  },

  /** 获取 Bot LLM 调用日志 */
  async getBotLogs(botId: string, offset: number = 0, limit: number = 20): Promise<{ logs: LLMCallLog[]; total: number }> {
    const res = await api.get<{ logs: LLMCallLog[]; total: number }>(`/bot/${botId}/logs`, {
      params: { offset, limit },
    });
    return res.data;
  },

  /** 清空 Bot LLM 调用日志 */
  async clearBotLogs(botId: string): Promise<void> {
    await api.delete(`/bot/${botId}/logs`);
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
};
