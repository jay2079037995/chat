/**
 * skill:sync Socket 事件测试
 *
 * 验证 Electron 客户端同步自定义 Skill 元数据到服务端的完整流程。
 */
import { SkillRegistry } from '../src/modules/skill/SkillRegistry';
import type { SkillDefinition, SkillSyncRequest, SkillSyncResult } from '@chat/shared';

// Mock Redis
const mockHset = jest.fn().mockResolvedValue(1);
const mockHgetall = jest.fn().mockResolvedValue({});
jest.mock('../src/repositories/redis/RedisClient', () => ({
  getRedisClient: () => ({
    hset: mockHset,
    hgetall: mockHgetall,
  }),
}));

/** 模拟 skill:sync 处理逻辑（与 SkillModule socketHandler 一致） */
async function handleSkillSync(
  registry: SkillRegistry,
  data: SkillSyncRequest,
): Promise<SkillSyncResult> {
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
    registry.unregister(skill.name);
    registry.register({ ...skill, source: 'custom' });
  }
  // 3. 加载 Redis 中持久化的启用状态
  await registry.loadEnabledStates();
  // 4. 返回完整 Skill 列表
  const all = registry.listSkills();
  return {
    registeredSkills: all.map((s) => ({ name: s.name, enabled: s.enabled !== false })),
  };
}

const builtinSkill: SkillDefinition = {
  name: 'builtin:notes',
  displayName: '备忘录',
  description: '内置',
  platform: 'mac',
  permission: 'read',
  source: 'builtin',
  actions: [
    { functionName: 'notes_list', description: '列出', parameters: { type: 'object', properties: {} } },
  ],
};

const customA: SkillDefinition = {
  name: 'custom:a',
  displayName: 'A',
  description: '自定义 A',
  platform: 'all',
  permission: 'read',
  source: 'custom',
  actions: [
    { functionName: 'a_run', description: '执行 A', parameters: { type: 'object', properties: {} } },
  ],
};

const customB: SkillDefinition = {
  name: 'custom:b',
  displayName: 'B',
  description: '自定义 B',
  platform: 'all',
  permission: 'write',
  source: 'custom',
  actions: [
    { functionName: 'b_run', description: '执行 B', parameters: { type: 'object', properties: {} } },
  ],
};

describe('skill:sync 同步逻辑', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
    registry.register(builtinSkill);
    mockHset.mockClear();
    mockHgetall.mockClear().mockResolvedValue({});
  });

  test('注册新的自定义 Skill', async () => {
    const result = await handleSkillSync(registry, { customSkills: [customA] });

    expect(registry.listSkills()).toHaveLength(2); // builtin + customA
    expect(registry.getSkill('custom:a')).toBeDefined();
    expect(result.registeredSkills).toHaveLength(2);
    expect(result.registeredSkills.find((s) => s.name === 'custom:a')?.enabled).toBe(true);
  });

  test('移除不再存在的自定义 Skill', async () => {
    // 先同步 A 和 B
    await handleSkillSync(registry, { customSkills: [customA, customB] });
    expect(registry.listSkills()).toHaveLength(3);

    // 再同步只有 A，B 应被移除
    const result = await handleSkillSync(registry, { customSkills: [customA] });
    expect(registry.listSkills()).toHaveLength(2);
    expect(registry.getSkill('custom:b')).toBeUndefined();
    expect(result.registeredSkills).toHaveLength(2);
  });

  test('同步不影响 builtin Skill', async () => {
    // 同步空列表不应移除 builtin
    const result = await handleSkillSync(registry, { customSkills: [] });
    expect(registry.getSkill('builtin:notes')).toBeDefined();
    expect(result.registeredSkills).toHaveLength(1);
    expect(result.registeredSkills[0].name).toBe('builtin:notes');
  });

  test('同步后 Redis 启用状态被加载', async () => {
    mockHgetall.mockResolvedValueOnce({ 'custom:a': '0' });

    const result = await handleSkillSync(registry, { customSkills: [customA] });

    expect(mockHgetall).toHaveBeenCalled();
    expect(result.registeredSkills.find((s) => s.name === 'custom:a')?.enabled).toBe(false);
  });
});
