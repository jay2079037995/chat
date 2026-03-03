/**
 * Skill 模块 — 远程 Skill 系统的服务端入口
 *
 * 管理 Skill 元数据注册和查询 API。
 * 在 BotModule 之前注册，确保 SkillRegistry 可供 Bot 使用。
 */
import { Router } from 'express';
import type { ServerModule, ModuleContext, ModuleRegistration } from '../../core/types';
import { SkillRegistry } from './SkillRegistry';
import { registerBuiltinSkills } from './definitions';

export class SkillModule implements ServerModule {
  name = 'skill';

  /** 对外暴露 SkillRegistry，供 BotModule 使用 */
  readonly skillRegistry = new SkillRegistry();

  register(_ctx: ModuleContext): ModuleRegistration {
    // 注册内置 Skill 定义
    registerBuiltinSkills(this.skillRegistry);

    const router = Router();

    /** 获取所有已注册 Skill 列表 */
    router.get('/list', (_req, res) => {
      const skills = this.skillRegistry.listSkills();
      res.json({ skills });
    });

    /** 获取单个 Skill 详情 */
    router.get('/:name', (req, res) => {
      const skill = this.skillRegistry.getSkill(req.params.name);
      if (!skill) {
        return res.status(404).json({ error: 'Skill not found' });
      }
      return res.json({ skill });
    });

    return { router };
  }
}
