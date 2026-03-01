import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('v0.1 - 开发服务器与配置', () => {
  test('2.1/2.2: 前端开发服务器启动并能加载页面', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    // webpack 首次编译可能较慢，给足等待时间
    await expect(page.locator('body')).not.toBeEmpty({ timeout: 30000 });
  });

  test('2.3: Webpack HMR 已配置', () => {
    const configPath = path.resolve(__dirname, '../../packages/client/webpack.config.js');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require(configPath);
    expect(config.devServer.hot).toBe(true);
  });

  test('3.1: 后端健康检查响应正常', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  test('3.3: ts-node-dev 自动重启已配置', () => {
    const pkgPath = path.resolve(__dirname, '../../packages/server/package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.scripts.dev).toContain('--respawn');
    expect(pkg.scripts.dev).toContain('ts-node-dev');
  });
});
