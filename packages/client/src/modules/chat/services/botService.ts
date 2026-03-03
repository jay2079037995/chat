/**
 * 机器人服务 —— 封装所有与 /api/bot 相关的 HTTP 请求
 */
import type { Bot, BotRunMode, LLMConfig, ProviderInfo, LLMProvider } from '@chat/shared';
import { api } from '../../../services/api';

export const botService = {
  /** 创建机器人 */
  async createBot(
    username: string,
    runMode: BotRunMode = 'client',
    llmConfig?: LLMConfig,
  ): Promise<{ bot: Bot; token?: string }> {
    const res = await api.post<{ bot: Bot; token?: string }>('/bot/create', {
      username, runMode, llmConfig,
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
};
