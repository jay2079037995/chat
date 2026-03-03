/**
 * SkillRegistry 单元测试
 */
import { SkillRegistry } from '../src/modules/skill/SkillRegistry';
import type { SkillDefinition } from '@chat/shared';

const mockSkill: SkillDefinition = {
  name: 'test:skill',
  displayName: '测试 Skill',
  description: '用于测试的 Skill',
  platform: 'mac',
  permission: 'read',
  actions: [
    {
      functionName: 'test_action_read',
      description: '只读操作',
      parameters: { type: 'object', properties: {} },
    },
    {
      functionName: 'test_action_write',
      description: '写入操作',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: '名称' } },
        required: ['name'],
      },
      permission: 'write',
    },
  ],
};

const mockSkill2: SkillDefinition = {
  name: 'test:skill2',
  displayName: '测试 Skill 2',
  description: '用于测试的 Skill 2',
  platform: 'windows',
  permission: 'read',
  actions: [
    {
      functionName: 'test2_action',
      description: 'Windows 操作',
      parameters: { type: 'object', properties: {} },
    },
  ],
};

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  test('注册和列出 Skill', () => {
    registry.register(mockSkill);
    const skills = registry.listSkills();
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('test:skill');
  });

  test('根据名称获取 Skill', () => {
    registry.register(mockSkill);
    expect(registry.getSkill('test:skill')).toBeDefined();
    expect(registry.getSkill('nonexistent')).toBeUndefined();
  });

  test('根据函数名查找 Action', () => {
    registry.register(mockSkill);
    const result = registry.findAction('test_action_read');
    expect(result).not.toBeNull();
    expect(result!.skill.name).toBe('test:skill');
    expect(result!.action.functionName).toBe('test_action_read');

    expect(registry.findAction('nonexistent')).toBeNull();
  });

  test('生成 LLM tools 数组', () => {
    registry.register(mockSkill);
    const tools = registry.generateTools();
    expect(tools).toHaveLength(2);
    expect(tools[0].type).toBe('function');
    expect(tools[0].function.name).toBe('test_action_read');
    expect(tools[1].function.name).toBe('test_action_write');
  });

  test('按平台过滤 tools', () => {
    registry.register(mockSkill);
    registry.register(mockSkill2);

    const macTools = registry.generateTools({ platform: 'mac' });
    expect(macTools).toHaveLength(2); // 只有 test:skill 的 2 个 action

    const winTools = registry.generateTools({ platform: 'windows' });
    expect(winTools).toHaveLength(1); // 只有 test:skill2 的 1 个 action
  });

  test('按白名单过滤 tools', () => {
    registry.register(mockSkill);
    const tools = registry.generateTools({
      allowedFunctions: ['test_action_read'],
    });
    expect(tools).toHaveLength(1);
    expect(tools[0].function.name).toBe('test_action_read');
  });
});
