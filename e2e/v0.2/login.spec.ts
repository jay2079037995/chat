import { test, expect } from '@playwright/test';
import { flushTestData, closeRedis } from '../helpers/redis';
import { registerUser } from '../helpers/api';
import { TEST_USERS, URLS } from '../fixtures/test-data';

test.describe('v0.2 - 登录流程', () => {
  test.beforeEach(async () => {
    await flushTestData();
    await registerUser(TEST_USERS.primary.username, TEST_USERS.primary.password);
  });

  test.afterAll(async () => {
    await closeRedis();
  });

  test('2.2.2: 登录成功 → Token 存入 localStorage → 跳转主页', async ({ page }) => {
    await page.goto(URLS.login, { waitUntil: 'networkidle' });

    await page.getByPlaceholder('用户名').fill(TEST_USERS.primary.username);
    await page.getByPlaceholder('密码').fill(TEST_USERS.primary.password);
    await page.getByRole('button', { name: /登.*录/ }).click();

    // Should redirect to home
    await expect(page).toHaveURL(URLS.home, { timeout: 10000 });

    // Token should be stored
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();

    // Session ID should be stored
    const sessionId = await page.evaluate(() => sessionStorage.getItem('sessionId'));
    expect(sessionId).toBeTruthy();
  });
});
