/**
 * 机器人服务 —— 封装所有与 /api/bot 相关的 HTTP 请求
 */
import type { Bot, BotWithToken } from '@chat/shared';
import { api } from '../../../services/api';

export const botService = {
  /** 创建机器人 */
  async createBot(username: string): Promise<{ bot: Bot; token: string }> {
    const res = await api.post<{ bot: Bot; token: string }>('/bot/create', { username });
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
};
