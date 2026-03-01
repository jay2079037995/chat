import { test, expect } from '@playwright/test';
import { flushTestData, closeRedis } from '../helpers/redis';
import { registerUser } from '../helpers/api';
import { TEST_USERS, URLS } from '../fixtures/test-data';

test.describe('v0.3 - 在线状态', () => {
  test.beforeEach(async () => {
    await flushTestData();
    await registerUser(TEST_USERS.primary.username, TEST_USERS.primary.password);
    await registerUser(TEST_USERS.secondary.username, TEST_USERS.secondary.password);
  });

  test.afterAll(async () => {
    await closeRedis();
  });

  test('5.1: 用户 B 先在线，用户 A 后连接 → A 能看到 B 在线', async ({ browser }) => {
    // 用户 B 先登录（建立 WebSocket 连接）
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await pageB.goto(URLS.login, { waitUntil: 'networkidle' });
    await pageB.getByPlaceholder('用户名').fill(TEST_USERS.secondary.username);
    await pageB.getByPlaceholder('密码').fill(TEST_USERS.secondary.password);
    await pageB.getByRole('button', { name: /登.*录/ }).click();
    await expect(pageB).toHaveURL(URLS.home, { timeout: 10000 });

    // 等待 B 的 WebSocket 连接建立
    await pageB.waitForTimeout(1000);

    // 用户 A 后登录
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await pageA.goto(URLS.login, { waitUntil: 'networkidle' });
    await pageA.getByPlaceholder('用户名').fill(TEST_USERS.primary.username);
    await pageA.getByPlaceholder('密码').fill(TEST_USERS.primary.password);
    await pageA.getByRole('button', { name: /登.*录/ }).click();
    await expect(pageA).toHaveURL(URLS.home, { timeout: 10000 });

    // A 搜索 B 并打开聊天
    const searchInput = pageA.getByPlaceholder('搜索用户');
    await searchInput.fill(TEST_USERS.secondary.username);
    await searchInput.press('Enter');
    await expect(pageA.getByText(TEST_USERS.secondary.username)).toBeVisible({ timeout: 5000 });
    await pageA.getByText(TEST_USERS.secondary.username).click();

    // 等待聊天窗口出现并检查在线状态
    await expect(pageA.getByPlaceholder('输入消息...')).toBeVisible({ timeout: 5000 });
    await expect(pageA.getByText('在线')).toBeVisible({ timeout: 5000 });

    await ctxA.close();
    await ctxB.close();
  });

  test('5.2: 用户 B 下线后，用户 A 看到 B 离线', async ({ browser }) => {
    // 用户 B 先登录
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await pageB.goto(URLS.login, { waitUntil: 'networkidle' });
    await pageB.getByPlaceholder('用户名').fill(TEST_USERS.secondary.username);
    await pageB.getByPlaceholder('密码').fill(TEST_USERS.secondary.password);
    await pageB.getByRole('button', { name: /登.*录/ }).click();
    await expect(pageB).toHaveURL(URLS.home, { timeout: 10000 });
    await pageB.waitForTimeout(1000);

    // 用户 A 后登录并搜索 B
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await pageA.goto(URLS.login, { waitUntil: 'networkidle' });
    await pageA.getByPlaceholder('用户名').fill(TEST_USERS.primary.username);
    await pageA.getByPlaceholder('密码').fill(TEST_USERS.primary.password);
    await pageA.getByRole('button', { name: /登.*录/ }).click();
    await expect(pageA).toHaveURL(URLS.home, { timeout: 10000 });

    const searchInput = pageA.getByPlaceholder('搜索用户');
    await searchInput.fill(TEST_USERS.secondary.username);
    await searchInput.press('Enter');
    await expect(pageA.getByText(TEST_USERS.secondary.username)).toBeVisible({ timeout: 5000 });
    await pageA.getByText(TEST_USERS.secondary.username).click();
    await expect(pageA.getByPlaceholder('输入消息...')).toBeVisible({ timeout: 5000 });

    // 此时 A 应看到 B 在线
    await expect(pageA.getByText('在线')).toBeVisible({ timeout: 5000 });

    // B 关闭页面（断开 WebSocket）
    await ctxB.close();

    // A 应看到 B 变为离线
    await expect(pageA.getByText('离线')).toBeVisible({ timeout: 10000 });

    await ctxA.close();
  });
});
