/**
 * 内置 Skill 定义结构合法性测试
 */
import { SkillRegistry } from '../src/modules/skill/SkillRegistry';
import { registerBuiltinSkills } from '../src/modules/skill/definitions';

describe('内置 Skill 定义', () => {
  let registry: SkillRegistry;

  beforeAll(() => {
    registry = new SkillRegistry();
    registerBuiltinSkills(registry);
  });

  test('应注册 10 个内置 Skill', () => {
    const skills = registry.listSkills();
    expect(skills).toHaveLength(10);
  });

  test('每个 Skill 应有合法的元数据结构', () => {
    for (const skill of registry.listSkills()) {
      expect(skill.name).toBeTruthy();
      expect(skill.displayName).toBeTruthy();
      expect(skill.description).toBeTruthy();
      expect(['mac', 'windows', 'linux', 'all']).toContain(skill.platform);
      expect(['read', 'write', 'execute', 'dangerous']).toContain(skill.permission);
      expect(skill.actions.length).toBeGreaterThan(0);

      for (const action of skill.actions) {
        expect(action.functionName).toBeTruthy();
        expect(action.description).toBeTruthy();
        expect(action.parameters.type).toBe('object');
        expect(action.parameters.properties).toBeDefined();
      }
    }
  });

  test('所有函数名应全局唯一', () => {
    const functionNames = new Set<string>();
    for (const skill of registry.listSkills()) {
      for (const action of skill.actions) {
        expect(functionNames.has(action.functionName)).toBe(false);
        functionNames.add(action.functionName);
      }
    }
  });
});
