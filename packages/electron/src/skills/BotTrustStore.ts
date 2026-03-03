/**
 * Bot 信任配置存储
 *
 * 使用 electron-store 持久化 Bot 信任配置。
 * 受信任的 Bot 执行任何权限级别的 Skill 操作时自动放行。
 */
import Store from 'electron-store';

/** Bot 信任配置（本地类型，与 @chat/shared BotTrustConfig 一致） */
export interface BotTrustConfig {
  botId: string;
  botUsername: string;
  trusted: boolean;
}

export class BotTrustStore {
  private store = new Store<{ trustedBots: Record<string, BotTrustConfig> }>({
    name: 'bot-trust',
    defaults: { trustedBots: {} },
  });

  /** 检查 Bot 是否受信任 */
  isTrusted(botId: string): boolean {
    const config = this.store.get('trustedBots')[botId];
    return config?.trusted === true;
  }

  /** 设置 Bot 信任状态 */
  setTrust(botId: string, botUsername: string, trusted: boolean): void {
    const bots = this.store.get('trustedBots');
    bots[botId] = { botId, botUsername, trusted };
    this.store.set('trustedBots', bots);
  }

  /** 获取所有 Bot 信任配置 */
  listTrustConfigs(): BotTrustConfig[] {
    return Object.values(this.store.get('trustedBots'));
  }

  /** 移除 Bot 信任配置 */
  removeTrust(botId: string): void {
    const bots = this.store.get('trustedBots');
    delete bots[botId];
    this.store.set('trustedBots', bots);
  }
}
