/**
 * 服务端机器人生命周期管理
 *
 * 管理所有服务端运行模式机器人的启动/停止/恢复/配置更新。
 * 服务器重启时自动恢复 status=running 的机器人。
 */
import type { Server as SocketIOServer } from 'socket.io';
import type { LLMConfig } from '@chat/shared';
import type { BotService } from './BotService';
import type { ToolDispatcher } from './ToolDispatcher';
import { ServerBotRunner } from './ServerBotRunner';

export class ServerBotManager {
  private runners = new Map<string, ServerBotRunner>();
  private io: SocketIOServer | null = null;
  private toolDispatcher?: ToolDispatcher;

  constructor(private botService: BotService) {}

  /** 延迟注入 Socket.IO 实例 */
  setIO(io: SocketIOServer): void {
    this.io = io;
  }

  /** 延迟注入 ToolDispatcher */
  setToolDispatcher(dispatcher: ToolDispatcher): void {
    this.toolDispatcher = dispatcher;
  }

  /** 设置 Bot 的 Skill 指令（由 Electron 通过 Socket.IO 推送） */
  setSkillInstructions(botId: string, instructions: string): void {
    const runner = this.runners.get(botId);
    if (runner) {
      runner.setSkillInstructions(instructions);
    }
  }

  /** 启动一个服务端 Bot */
  async startBot(botId: string, llmConfig: LLMConfig): Promise<void> {
    // 已在运行则先停止
    if (this.runners.has(botId)) {
      await this.stopBot(botId);
    }

    const runner = new ServerBotRunner(
      botId, llmConfig, this.botService, this.io,
      this.toolDispatcher,
    );
    this.runners.set(botId, runner);
    await runner.start();
  }

  /** 停止一个服务端 Bot */
  async stopBot(botId: string): Promise<void> {
    const runner = this.runners.get(botId);
    if (!runner) return;

    await runner.stop();
    this.runners.delete(botId);
  }

  /** 停止所有服务端 Bot（优雅关机时调用） */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.runners.keys()).map((id) => this.stopBot(id));
    await Promise.all(stopPromises);
  }

  /** 获取某个 Bot 的运行状态 */
  getBotStatus(botId: string) {
    const runner = this.runners.get(botId);
    if (!runner) return null;
    return runner.getStatus();
  }

  /** 热更新 Bot LLM 配置 */
  async updateBotConfig(botId: string, llmConfig: LLMConfig): Promise<void> {
    await this.botService.saveServerBotConfig(botId, llmConfig);

    const runner = this.runners.get(botId);
    if (runner) {
      runner.updateConfig(llmConfig);
    }
  }

  /** 服务器启动时恢复所有运行中的服务端 Bot */
  async recoverRunningBots(): Promise<void> {
    const botIds = await this.botService.getRunningServerBots();

    for (const botId of botIds) {
      const { status } = await this.botService.getBotStatus(botId);
      if (status !== 'running') continue;

      const llmConfig = await this.botService.getServerBotConfig(botId);
      if (!llmConfig) continue;

      try {
        await this.startBot(botId, llmConfig);
      } catch {
        await this.botService.setBotStatus(botId, 'error', '恢复启动失败');
      }
    }
  }

  /** 检查某个 Bot 是否正在运行 */
  isRunning(botId: string): boolean {
    return this.runners.has(botId);
  }
}
