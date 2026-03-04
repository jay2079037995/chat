/**
 * ClaudeSkillParser 测试
 *
 * 测试 SKILL.md 的 YAML frontmatter 解析和指令提取。
 */
import { parseSkillMdContent } from '../src/claudeskill/ClaudeSkillParser';

describe('ClaudeSkillParser', () => {
  test('解析完整的 SKILL.md 内容', () => {
    const raw = `---
name: test-skill
description: A test skill
version: 1.0.0
author: tester
tags:
  - test
  - demo
---

# Instructions

This is the skill instruction body.

Use bash_exec to run commands.
`;
    const result = parseSkillMdContent(raw);
    expect(result.name).toBe('test-skill');
    expect(result.description).toBe('A test skill');
    expect(result.version).toBe('1.0.0');
    expect(result.author).toBe('tester');
    expect(result.tags).toEqual(['test', 'demo']);
    expect(result.instructions).toContain('This is the skill instruction body.');
    expect(result.instructions).toContain('Use bash_exec to run commands.');
  });

  test('解析无 frontmatter 的内容（仅 Markdown）', () => {
    const raw = `# My Skill

Just instructions, no frontmatter.
`;
    const result = parseSkillMdContent(raw);
    expect(result.name).toBe('unknown');
    expect(result.description).toBe('');
    expect(result.instructions).toContain('Just instructions, no frontmatter.');
  });

  test('解析只有 name 和 description 的 frontmatter', () => {
    const raw = `---
name: simple-skill
description: Simple description
---

Do something useful.
`;
    const result = parseSkillMdContent(raw);
    expect(result.name).toBe('simple-skill');
    expect(result.description).toBe('Simple description');
    expect(result.version).toBeUndefined();
    expect(result.author).toBeUndefined();
    expect(result.tags).toBeUndefined();
    expect(result.instructions).toContain('Do something useful.');
  });

  test('空内容返回默认值', () => {
    const result = parseSkillMdContent('');
    expect(result.name).toBe('unknown');
    expect(result.description).toBe('');
    expect(result.instructions).toBe('');
  });

  test('frontmatter 中有空 tags 数组', () => {
    const raw = `---
name: no-tags
description: No tags
tags: []
---

Instructions here.
`;
    const result = parseSkillMdContent(raw);
    expect(result.name).toBe('no-tags');
    expect(result.tags).toEqual([]);
  });
});
