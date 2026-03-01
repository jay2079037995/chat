import { test, expect } from '@playwright/test';
import { flushTestData, closeRedis } from '../helpers/redis';
import { registerUser } from '../helpers/api';
import { TEST_USERS, URLS } from '../fixtures/test-data';

test.describe('v0.3 - 一对一聊天', () => {
  test.beforeEach(async () => {
    await flushTestData();
    // 注册两个用户
    await registerUser(TEST_USERS.primary.username, TEST_USERS.primary.password);
    await registerUser(TEST_USERS.secondary.username, TEST_USERS.secondary.password);
  });

  test.afterAll(async () => {
    await closeRedis();
  });

  test('3.3.1: 搜索用户并发起私聊 → 会话列表出现', async ({ page }) => {
    // 用户1登录
    await page.goto(URLS.login, { waitUntil: 'networkidle' });
    await page.getByPlaceholder('用户名').fill(TEST_USERS.primary.username);
    await page.getByPlaceholder('密码').fill(TEST_USERS.primary.password);
    await page.getByRole('button', { name: /登.*录/ }).click();
    await expect(page).toHaveURL(URLS.home, { timeout: 10000 });

    // 搜索用户2
    const searchInput = page.getByPlaceholder('搜索用户');
    await searchInput.fill(TEST_USERS.secondary.username);
    await searchInput.press('Enter');

    // 等待搜索结果并点击
    await expect(page.getByText(TEST_USERS.secondary.username)).toBeVisible({ timeout: 5000 });
    await page.getByText(TEST_USERS.secondary.username).click();

    // 应该出现聊天窗口
    await expect(page.getByPlaceholder('输入消息...')).toBeVisible({ timeout: 5000 });
  });

  test('3.2.1: 用户A发送文本消息 → 消息出现在聊天窗口', async ({ page }) => {
    // 登录
    await page.goto(URLS.login, { waitUntil: 'networkidle' });
    await page.getByPlaceholder('用户名').fill(TEST_USERS.primary.username);
    await page.getByPlaceholder('密码').fill(TEST_USERS.primary.password);
    await page.getByRole('button', { name: /登.*录/ }).click();
    await expect(page).toHaveURL(URLS.home, { timeout: 10000 });

    // 搜索用户2并发起聊天
    const searchInput = page.getByPlaceholder('搜索用户');
    await searchInput.fill(TEST_USERS.secondary.username);
    await searchInput.press('Enter');
    await expect(page.getByText(TEST_USERS.secondary.username)).toBeVisible({ timeout: 5000 });
    await page.getByText(TEST_USERS.secondary.username).click();

    // 等待聊天窗口出现
    await expect(page.getByPlaceholder('输入消息...')).toBeVisible({ timeout: 5000 });

    // 输入并发送消息
    await page.getByPlaceholder('输入消息...').fill('你好，这是测试消息');
    await page.getByRole('button', { name: '发送' }).click();

    // 消息应该出现在聊天区域（限定 main 区域，避免与侧栏 lastMessage 冲突）
    await expect(page.getByRole('main').getByText('你好，这是测试消息')).toBeVisible({ timeout: 5000 });
  });

  test('3.4.3: Enter 键发送消息', async ({ page }) => {
    // 登录
    await page.goto(URLS.login, { waitUntil: 'networkidle' });
    await page.getByPlaceholder('用户名').fill(TEST_USERS.primary.username);
    await page.getByPlaceholder('密码').fill(TEST_USERS.primary.password);
    await page.getByRole('button', { name: /登.*录/ }).click();
    await expect(page).toHaveURL(URLS.home, { timeout: 10000 });

    // 搜索并发起聊天
    const searchInput = page.getByPlaceholder('搜索用户');
    await searchInput.fill(TEST_USERS.secondary.username);
    await searchInput.press('Enter');
    await expect(page.getByText(TEST_USERS.secondary.username)).toBeVisible({ timeout: 5000 });
    await page.getByText(TEST_USERS.secondary.username).click();

    await expect(page.getByPlaceholder('输入消息...')).toBeVisible({ timeout: 5000 });

    // 用 Enter 键发送
    await page.getByPlaceholder('输入消息...').fill('Enter 测试');
    await page.getByPlaceholder('输入消息...').press('Enter');

    await expect(page.getByRole('main').getByText('Enter 测试')).toBeVisible({ timeout: 5000 });
  });
});
