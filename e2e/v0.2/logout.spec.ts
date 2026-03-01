import { test, expect } from '@playwright/test';
import { flushTestData, closeRedis } from '../helpers/redis';
import { TEST_USERS, URLS } from '../fixtures/test-data';

test.describe('v0.2 - 登出流程', () => {
  test.beforeEach(async () => {
    await flushTestData();
  });

  test.afterAll(async () => {
    await closeRedis();
  });

  test('4.3: 点击登出 → 清除 Token/Session → 跳转登录页', async ({ page }) => {
    // First register and login
    await page.goto(URLS.register);
    await page.getByPlaceholder('用户名').fill(TEST_USERS.primary.username);
    await page.locator('input[type="password"]').first().fill(TEST_USERS.primary.password);
    await page.locator('input[type="password"]').nth(1).fill(TEST_USERS.primary.password);
    await page.getByRole('button', { name: /注.*册/ }).click();

    // Wait for home page
    await expect(page).toHaveURL(URLS.home, { timeout: 10000 });
    await expect(page.getByText('欢迎使用 Chat')).toBeVisible();

    // Click logout button
    await page.getByRole('button', { name: '登出' }).click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // Token and session should be cleared
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const sessionId = await page.evaluate(() => sessionStorage.getItem('sessionId'));
    expect(token).toBeNull();
    expect(sessionId).toBeNull();
  });
});
