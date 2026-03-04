/**
 * SkillRegistry v1.12.0 增强功能测试
 *
 * 覆盖 unregister、setEnabled、loadEnabledStates、generateTools 禁用过滤
 */
import { SkillRegistry } from '../src/modules/skill/SkillRegistry';
import type { SkillDefinition } from '@chat/shared';

// Mock Redis
const mockHset = jest.fn().mockResolvedValue(1);
const mockHgetall = jest.fn().mockResolvedValue({});
jest.mock('../src/repositories/redis/RedisClient', () => ({
  getRedisClient: () => ({
    hset: mockHset,
    hgetall: mockHgetall,
  }),
}));

const builtinSkill: SkillDefinition = {
  name: 'builtin:notes',
  displayName: '备忘录',
  description: '内置备忘录 Skill',
  version: '1.0.0',
  platform: 'mac',
  permission: 'read',
  source: 'builtin',
  actions: [
    {
      functionName: 'notes_list',
      description: '列出备忘录',
      parameters: { type: 'object', properties: {} },
    },
  ],
};

const customSkill: SkillDefinition = {
  name: 'custom:weather',
  displayName: '天气查询',
  description: '自定义天气 Skill',
  version: '1.0.0',
  platform: 'all',
  permission: 'read',
  source: 'custom',
  actions: [
    {
      functionName: 'weather_query',
      description: '查询天气',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string', description: '城市' } },
        required: ['city'],
      },
    },
  ],
};

const customSkill2: SkillDefinition = {
  name: 'custom:translate',
  displayName: '翻译',
  description: '自定义翻译 Skill',
  version: '1.0.0',
  platform: 'all',
  permission: 'read',
  source: 'custom',
  actions: [
    {
      functionName: 'translate_text',
      description: '翻译文本',
      parameters: { type: 'object', properties: {} },
    },
  ],
};

describe('SkillRegistry v1.12.0 增强', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
    mockHset.mockClear();
    mockHgetall.mockClear();
  });

  // --- unregister ---

  describe('unregister', () => {
    test('可以注销 custom Skill', () => {
      registry.register(customSkill);
      expect(registry.listSkills()).toHaveLength(1);

      const result = registry.unregister('custom:weather');
      expect(result).toBe(true);
      expect(registry.listSkills()).toHaveLength(0);
      expect(registry.findAction('weather_query')).toBeNull();
    });

    test('不能注销 builtin Skill', () => {
      registry.register(builtinSkill);
      const result = registry.unregister('builtin:notes');
      expect(result).toBe(false);
      expect(registry.listSkills()).toHaveLength(1);
    });

    test('注销不存在的 Skill 返回 false', () => {
      expect(registry.unregister('nonexistent')).toBe(false);
    });
  });

  // --- register source 默认值 ---

  test('register 自动填充 source 默认值为 builtin', () => {
    const noSourceSkill: SkillDefinition = {
      name: 'test:no-source',
      displayName: '无 source',
      description: '测试',
      version: '1.0.0',
      platform: 'all',
      permission: 'read',
      actions: [],
    };
    registry.register(noSourceSkill);
    const skill = registry.getSkill('test:no-source');
    expect(skill?.source).toBe('builtin');
  });

  // --- setEnabled ---

  describe('setEnabled', () => {
    test('成功禁用已注册的 Skill', async () => {
      registry.register(customSkill);
      const result = await registry.setEnabled('custom:weather', false);
      expect(result).toBe(true);
      expect(mockHset).toHaveBeenCalledWith('skill_enabled', 'custom:weather', '0');
      expect(registry.getSkill('custom:weather')?.enabled).toBe(false);
    });

    test('成功启用已注册的 Skill', async () => {
      registry.register(customSkill);
      const result = await registry.setEnabled('custom:weather', true);
      expect(result).toBe(true);
      expect(mockHset).toHaveBeenCalledWith('skill_enabled', 'custom:weather', '1');
      expect(registry.getSkill('custom:weather')?.enabled).toBe(true);
    });

    test('对不存在的 Skill 返回 false', async () => {
      const result = await registry.setEnabled('nonexistent', true);
      expect(result).toBe(false);
    });
  });

  // --- loadEnabledStates ---

  test('loadEnabledStates 从 Redis 恢复启用状态', async () => {
    registry.register(builtinSkill);
    registry.register(customSkill);

    mockHgetall.mockResolvedValueOnce({
      'builtin:notes': '0',
      'custom:weather': '1',
    });

    await registry.loadEnabledStates();

    expect(registry.getSkill('builtin:notes')?.enabled).toBe(false);
    expect(registry.getSkill('custom:weather')?.enabled).toBe(true);
  });

  // --- generateTools 禁用过滤 ---

  describe('generateTools 禁用过滤', () => {
    test('禁用的 Skill 不出现在 tools 中', () => {
      registry.register({ ...builtinSkill, enabled: false });
      registry.register(customSkill);

      const tools = registry.generateTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].function.name).toBe('weather_query');
    });

    test('enabled 为 undefined 时视为启用', () => {
      registry.register(builtinSkill); // enabled 未设置
      const tools = registry.generateTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].function.name).toBe('notes_list');
    });
  });
});
