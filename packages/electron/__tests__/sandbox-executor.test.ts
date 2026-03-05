/**
 * SandboxExecutor 测试
 *
 * 测试环境变量过滤、脚本执行、输出截断。
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SandboxExecutor } from '../src/claudeskill/SandboxExecutor';

describe('SandboxExecutor', () => {
  let executor: SandboxExecutor;
  let tmpDir: string;

  beforeAll(() => {
    executor = new SandboxExecutor();
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sandbox-test-')));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('执行 shell 脚本', async () => {
    const script = path.join(tmpDir, 'test.sh');
    fs.writeFileSync(script, '#!/bin/bash\necho "hello sandbox"', { mode: 0o755 });

    const result = await executor.execute(script);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello sandbox');
  });

  test('执行 Python 脚本', async () => {
    const script = path.join(tmpDir, 'test.py');
    fs.writeFileSync(script, 'print("hello python")');

    const result = await executor.execute(script);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello python');
  });

  test('执行 Node.js 脚本', async () => {
    const script = path.join(tmpDir, 'test.js');
    fs.writeFileSync(script, 'console.log("hello node")');

    const result = await executor.execute(script);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello node');
  });

  test('传递命令行参数', async () => {
    const script = path.join(tmpDir, 'args.sh');
    fs.writeFileSync(script, '#!/bin/bash\necho "$1 $2"', { mode: 0o755 });

    const result = await executor.execute(script, ['hello', 'world']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello world');
  });

  test('传递标准输入', async () => {
    const script = path.join(tmpDir, 'stdin.sh');
    fs.writeFileSync(script, '#!/bin/bash\nread line; echo "got: $line"', { mode: 0o755 });

    const result = await executor.execute(script, [], 'input data');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('got: input data');
  });

  test('脚本失败返回非零退出码', async () => {
    const script = path.join(tmpDir, 'fail.sh');
    fs.writeFileSync(script, '#!/bin/bash\nexit 42', { mode: 0o755 });

    const result = await executor.execute(script);
    expect(result.exitCode).not.toBe(0);
  });

  test('超时返回错误', async () => {
    const script = path.join(tmpDir, 'timeout.sh');
    fs.writeFileSync(script, '#!/bin/bash\nsleep 10', { mode: 0o755 });

    const result = await executor.execute(script, [], undefined, undefined, undefined, 1000);
    expect(result.exitCode).not.toBe(0);
  }, 10000);

  test('stdout 输出截断', async () => {
    const script = path.join(tmpDir, 'big-output.js');
    // 生成 > 10000 字符的输出
    fs.writeFileSync(script, `console.log("x".repeat(15000))`);

    const result = await executor.execute(script);
    expect(result.stdout.length).toBeLessThanOrEqual(10100); // 10000 + truncation notice
    expect(result.stdout).toContain('truncated');
  });

  test('环境变量不含敏感信息', async () => {
    const script = path.join(tmpDir, 'env.sh');
    fs.writeFileSync(script, '#!/bin/bash\nenv', { mode: 0o755 });

    const result = await executor.execute(script, [], undefined, {
      SAFE_VAR: 'safe_value',
      MY_SECRET: 'should_be_filtered',
      API_KEY: 'should_be_filtered',
      AUTH_TOKEN: 'should_be_filtered',
    });

    expect(result.stdout).toContain('SAFE_VAR=safe_value');
    expect(result.stdout).not.toContain('MY_SECRET');
    expect(result.stdout).not.toContain('API_KEY');
    expect(result.stdout).not.toContain('AUTH_TOKEN');
  });

  test('使用自定义工作目录', async () => {
    const workDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sandbox-work-')));
    const script = path.join(tmpDir, 'pwd.sh');
    fs.writeFileSync(script, '#!/bin/bash\npwd', { mode: 0o755 });

    const result = await executor.execute(script, [], undefined, undefined, workDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(workDir);

    fs.rmSync(workDir, { recursive: true, force: true });
  });
});
