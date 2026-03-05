/**
 * GenericToolExecutor 测试
 *
 * 测试 bash_exec/read_file/write_file/list_files 工具执行和路径沙箱校验。
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { GenericToolExecutor } from '../src/claudeskill/GenericToolExecutor';

describe('GenericToolExecutor', () => {
  let executor: GenericToolExecutor;
  let workspacePath: string;
  let skillDir: string;

  beforeAll(() => {
    executor = new GenericToolExecutor();
    // 创建临时工作区（使用 realpathSync 解决 macOS /var → /private/var 问题）
    workspacePath = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'test-workspace-')));
    skillDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'test-skill-')));
    // 写入测试文件
    fs.writeFileSync(path.join(workspacePath, 'hello.txt'), 'Hello World');
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test Skill');
    fs.mkdirSync(path.join(workspacePath, 'subdir'));
    fs.writeFileSync(path.join(workspacePath, 'subdir', 'nested.txt'), 'nested content');
  });

  afterAll(() => {
    fs.rmSync(workspacePath, { recursive: true, force: true });
    fs.rmSync(skillDir, { recursive: true, force: true });
  });

  const makeRequest = (toolName: string, params: Record<string, unknown>) => ({
    requestId: 'test-req',
    toolName: toolName as any,
    params,
    botId: 'test-bot',
    conversationId: 'test-conv',
  });

  describe('read_file', () => {
    test('读取工作区文件', async () => {
      const result = await executor.execute(
        makeRequest('read_file', { path: 'hello.txt' }),
        workspacePath,
        [skillDir],
      );
      expect(result.success).toBe(true);
      expect(result.data).toBe('Hello World');
    });

    test('读取 Skill 目录文件（绝对路径）', async () => {
      const skillFilePath = path.join(skillDir, 'SKILL.md');
      const result = await executor.execute(
        makeRequest('read_file', { path: skillFilePath }),
        workspacePath,
        [skillDir],
      );
      expect(result.success).toBe(true);
      expect(result.data).toBe('# Test Skill');
    });

    test('拒绝路径遍历攻击', async () => {
      const result = await executor.execute(
        makeRequest('read_file', { path: '../../../etc/passwd' }),
        workspacePath,
        [skillDir],
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('路径');
    });
  });

  describe('write_file', () => {
    test('写入工作区文件', async () => {
      const result = await executor.execute(
        makeRequest('write_file', { path: 'output.txt', content: 'test output' }),
        workspacePath,
        [skillDir],
      );
      expect(result.success).toBe(true);
      const content = fs.readFileSync(path.join(workspacePath, 'output.txt'), 'utf-8');
      expect(content).toBe('test output');
    });

    test('拒绝写入 Skill 目录', async () => {
      const result = await executor.execute(
        makeRequest('write_file', { path: '../' + path.basename(skillDir) + '/hack.txt', content: 'bad' }),
        workspacePath,
        [skillDir],
      );
      expect(result.success).toBe(false);
    });
  });

  describe('list_files', () => {
    test('列出工作区根目录', async () => {
      const result = await executor.execute(
        makeRequest('list_files', {}),
        workspacePath,
        [skillDir],
      );
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      const files = result.data as string[];
      expect(files).toContain('hello.txt');
    });

    test('列出子目录', async () => {
      const result = await executor.execute(
        makeRequest('list_files', { path: 'subdir' }),
        workspacePath,
        [skillDir],
      );
      expect(result.success).toBe(true);
      expect(result.data).toContain('nested.txt');
    });
  });

  describe('bash_exec', () => {
    test('执行简单命令', async () => {
      const result = await executor.execute(
        makeRequest('bash_exec', { command: 'echo hello' }),
        workspacePath,
        [skillDir],
      );
      expect(result.success).toBe(true);
      expect((result.data as string).trim()).toBe('hello');
    });

    test('命令执行在工作区目录中', async () => {
      const result = await executor.execute(
        makeRequest('bash_exec', { command: 'pwd' }),
        workspacePath,
        [skillDir],
      );
      expect(result.success).toBe(true);
      expect((result.data as string).trim()).toBe(workspacePath);
    });
  });

  describe('read_file_binary', () => {
    test('读取单文件为 base64', async () => {
      const result = await executor.execute(
        makeRequest('read_file_binary', { path: 'hello.txt' }),
        workspacePath,
        [skillDir],
      );
      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.fileName).toBe('hello.txt');
      expect(data.base64).toBe(Buffer.from('Hello World').toString('base64'));
      expect(data.fileSize).toBe(11);
      expect(data.mimeType).toBe('text/plain');
    });

    test('读取目录自动打包为 zip', async () => {
      const result = await executor.execute(
        makeRequest('read_file_binary', { path: 'subdir' }),
        workspacePath,
        [skillDir],
      );
      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.fileName).toBe('subdir.zip');
      expect(data.mimeType).toBe('application/zip');
      expect(data.base64.length).toBeGreaterThan(0);
      expect(data.fileSize).toBeGreaterThan(0);
    });

    test('不存在的文件返回错误', async () => {
      const result = await executor.execute(
        makeRequest('read_file_binary', { path: 'nonexistent.txt' }),
        workspacePath,
        [skillDir],
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('不存在');
    });

    test('拒绝路径遍历攻击', async () => {
      const result = await executor.execute(
        makeRequest('read_file_binary', { path: '../../../etc/passwd' }),
        workspacePath,
        [skillDir],
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('路径');
    });
  });

  describe('未知工具', () => {
    test('拒绝未知工具名', async () => {
      const result = await executor.execute(
        makeRequest('unknown_tool', {}),
        workspacePath,
        [skillDir],
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('未知工具');
    });
  });
});
