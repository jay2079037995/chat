/**
 * Skill 模块 — 远程 Skill 系统的服务端入口
 *
 * 管理 Skill 元数据注册和查询 API。
 * 支持动态注册/注销自定义 Skill，启用/禁用（Redis 持久化）。
 * 在 BotModule 之前注册，确保 SkillRegistry 可供 Bot 使用。
 */
import { Router } from 'express';
import type { ServerModule, ModuleContext, ModuleRegistration, TypedIO, TypedSocket } from '../../core/types';
import { SkillRegistry } from './SkillRegistry';
import { registerBuiltinSkills } from './definitions';

export class SkillModule implements ServerModule {
  name = 'skill';

  /** 对外暴露 SkillRegistry，供 BotModule 使用 */
  readonly skillRegistry = new SkillRegistry();

  register(_ctx: ModuleContext): ModuleRegistration {
    // 注册内置 Skill 定义
    registerBuiltinSkills(this.skillRegistry);
    // 异步加载 Redis 中的启用/禁用状态
    void this.skillRegistry.loadEnabledStates();

    const router = Router();
    const registry = this.skillRegistry;

    /** 获取所有已注册 Skill 列表 */
    router.get('/list', (_req, res) => {
      const skills = registry.listSkills();
      res.json({ skills });
    });

    /** 获取单个 Skill 详情 */
    router.get('/:name', (req, res) => {
      const skill = registry.getSkill(req.params.name);
      if (!skill) {
        return res.status(404).json({ error: 'Skill not found' });
      }
      return res.json({ skill });
    });

    /** 设置 Skill 启用/禁用 */
    router.put('/:name/enable', async (req, res) => {
      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: '需要 enabled 布尔值' });
      }
      const success = await registry.setEnabled(req.params.name, enabled);
      if (!success) {
        return res.status(404).json({ error: 'Skill 不存在' });
      }
      return res.json({ name: req.params.name, enabled });
    });

    /** Socket 事件：处理 skill:sync（Electron 客户端同步自定义 Skill 元数据） */
    const socketHandler = (_io: TypedIO, socket: TypedSocket) => {
      socket.on('skill:sync', async (data, callback) => {
        // 1. 移除服务端已有但本次同步中不存在的 custom Skill
        const existingCustom = registry.listSkills().filter((s) => s.source === 'custom');
        const incomingNames = new Set(data.customSkills.map((s) => s.name));
        for (const existing of existingCustom) {
          if (!incomingNames.has(existing.name)) {
            registry.unregister(existing.name);
          }
        }
        // 2. 注册/更新来自客户端的自定义 Skill
        for (const skill of data.customSkills) {
          // 先移除旧的（如果存在），再重新注册
          registry.unregister(skill.name);
          registry.register({ ...skill, source: 'custom' });
        }
        // 3. 加载 Redis 中持久化的启用状态
        await registry.loadEnabledStates();
        // 4. 返回完整 Skill 列表（含启用状态）
        const all = registry.listSkills();
        callback({
          registeredSkills: all.map((s) => ({ name: s.name, enabled: s.enabled !== false })),
        });
      });
    };

    return { router, socketHandler };
  }
}
