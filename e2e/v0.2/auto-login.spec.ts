import { test, expect } from '@playwright/test';
import { flushTestData, closeRedis } from '../helpers/redis';
import { registerUser } from '../helpers/api';
import { TEST_USERS, URLS } from '../fixtures/test-data';

test.describe('v0.2 - 自动登录', () => {
  test.beforeEach(async () => {
    await flushTestData();
  });

  test.afterAll(async () => {
    await closeRedis();
  });

  test('3.2.1: 有效 Token → 刷新页面 → 自动登录成功', async ({ page }) => {
    // Register user and get a valid token
    const result = await registerUser(TEST_USERS.primary.username, TEST_USERS.primary.password);

    // Navigate to login page first to set localStorage
    await page.goto(URLS.login);
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, result.token);

    // Navigate to home (protected route)
    await page.goto(URLS.home);

    // Should auto-login and stay on home
    await expect(page.getByText('欢迎使用 Chat')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(URLS.home);
  });

  test('3.2.2: 无效 Token → 刷新页面 → 清除 Token → 跳转登录', async ({ page }) => {
    // Set an invalid token
    await page.goto(URLS.login);
    await page.evaluate(() => {
      localStorage.setItem('token', 'invalid-token-xxx');
    });

    // Navigate to home (protected route)
    await page.goto(URLS.home);

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // Token should be cleared
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });
});
