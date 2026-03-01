import { test, expect } from '@playwright/test';
import { flushTestData, closeRedis } from '../helpers/redis';
import { TEST_USERS, URLS } from '../fixtures/test-data';

test.describe('v0.2 - 注册流程', () => {
  test.beforeEach(async () => {
    await flushTestData();
  });

  test.afterAll(async () => {
    await closeRedis();
  });

  test('1.2.4: 注册成功 → 自动登录 → 跳转主页', async ({ page }) => {
    await page.goto(URLS.register);

    await page.getByPlaceholder('用户名').fill(TEST_USERS.primary.username);
    await page.locator('input[type="password"]').first().fill(TEST_USERS.primary.password);
    await page.locator('input[type="password"]').nth(1).fill(TEST_USERS.primary.password);
    await page.getByRole('button', { name: /注.*册/ }).click();

    // Should redirect to home
    await expect(page).toHaveURL(URLS.home, { timeout: 10000 });

    // localStorage should have token
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();

    // Home page should be visible
    await expect(page.getByText('欢迎使用 Chat')).toBeVisible();
  });
});
