import { test, expect } from '@playwright/test';
import { flushTestData, closeRedis } from '../helpers/redis';
import { registerUser, createGroup } from '../helpers/api';
import { TEST_USERS, URLS } from '../fixtures/test-data';

test.describe('v0.5 - 群组聊天', () => {
  test.beforeEach(async () => {
    await flushTestData();
    // 注册三个用户
    await registerUser(TEST_USERS.primary.username, TEST_USERS.primary.password);
    await registerUser(TEST_USERS.secondary.username, TEST_USERS.secondary.password);
    await registerUser(TEST_USERS.tertiary.username, TEST_USERS.tertiary.password);
  });

  test.afterAll(async () => {
    await closeRedis();
  });

  test('5.1.1: 创建群组 → 群组出现在会话列表', async ({ page }) => {
    // 用户1登录
    await page.goto(URLS.login, { waitUntil: 'networkidle' });
    await page.getByPlaceholder('用户名').fill(TEST_USERS.primary.username);
    await page.getByPlaceholder('密码').fill(TEST_USERS.primary.password);
    await page.getByRole('button', { name: /登.*录/ }).click();
    await expect(page).toHaveURL(URLS.home, { timeout: 10000 });

    // 点击创建群组按钮
    await page.getByRole('button', { name: '创建群组' }).click();

    // 填写群名
    await page.getByPlaceholder('请输入群名称').fill('E2E测试群');

    // 搜索并添加成员
    const searchInput = page.locator('.ant-modal').getByPlaceholder('搜索用户');
    await searchInput.fill(TEST_USERS.secondary.username);
    await searchInput.press('Enter');

    // 等待搜索结果并点击搜索结果条目
    await expect(page.locator('.ant-modal').getByText(TEST_USERS.secondary.username)).toBeVisible({ timeout: 5000 });
    await page.locator('.ant-modal .ant-list-item').first().click();

    // 等待已选成员标签出现
    await expect(page.locator('.ant-modal .ant-tag').getByText(TEST_USERS.secondary.username)).toBeVisible({ timeout: 3000 });

    // 确认创建（Modal 中的 OK 按钮）
    await page.locator('.ant-modal-footer button.ant-btn-primary').click();

    // 群组应该出现在会话列表（限定侧栏区域）
    await expect(page.getByRole('complementary').getByText('E2E测试群')).toBeVisible({ timeout: 10000 });
  });

  test('5.1.2: 群组出现在所有成员的会话列表 (API)', async ({ page }) => {
    // 通过 API 注册用户并获取 session
    await flushTestData();
    const user1 = await registerUser(TEST_USERS.primary.username, TEST_USERS.primary.password);
    const user2 = await registerUser(TEST_USERS.secondary.username, TEST_USERS.secondary.password);
    const user3 = await registerUser(TEST_USERS.tertiary.username, TEST_USERS.tertiary.password);

    // 通过 API 创建群组
    const groupResult = await createGroup(
      user1.sessionId,
      'API群组测试',
      [user2.user.id, user3.user.id],
    );

    expect(groupResult.group).toBeDefined();
    expect(groupResult.group.name).toBe('API群组测试');
    expect(groupResult.conversation.type).toBe('group');

    // 用户2登录 → 能看到群组
    await page.goto(URLS.login, { waitUntil: 'networkidle' });
    await page.getByPlaceholder('用户名').fill(TEST_USERS.secondary.username);
    await page.getByPlaceholder('密码').fill(TEST_USERS.secondary.password);
    await page.getByRole('button', { name: /登.*录/ }).click();
    await expect(page).toHaveURL(URLS.home, { timeout: 10000 });

    await expect(page.getByText('API群组测试')).toBeVisible({ timeout: 10000 });
  });

  test('5.2.1: 群消息发送 → 消息出现在聊天窗口', async ({ page }) => {
    // 通过 API 创建用户和群组
    await flushTestData();
    const user1 = await registerUser(TEST_USERS.primary.username, TEST_USERS.primary.password);
    const user2 = await registerUser(TEST_USERS.secondary.username, TEST_USERS.secondary.password);

    await createGroup(user1.sessionId, '消息测试群', [user2.user.id]);

    // 用户1登录并打开群组
    await page.goto(URLS.login, { waitUntil: 'networkidle' });
    await page.getByPlaceholder('用户名').fill(TEST_USERS.primary.username);
    await page.getByPlaceholder('密码').fill(TEST_USERS.primary.password);
    await page.getByRole('button', { name: /登.*录/ }).click();
    await expect(page).toHaveURL(URLS.home, { timeout: 10000 });

    // 点击群组会话
    await page.getByText('消息测试群').click();
    await expect(page.getByPlaceholder('输入消息...')).toBeVisible({ timeout: 5000 });

    // 发送消息
    await page.getByPlaceholder('输入消息...').fill('群消息测试');
    await page.getByRole('button', { name: '发送' }).click();

    // 消息应该出现
    await expect(page.getByRole('main').getByText('群消息测试')).toBeVisible({ timeout: 5000 });
  });

  test('5.3.1: 群主移除成员 → 被移除成员看不到群组 (API)', async () => {
    // 通过 API 创建用户和群组
    await flushTestData();
    const user1 = await registerUser(TEST_USERS.primary.username, TEST_USERS.primary.password);
    const user2 = await registerUser(TEST_USERS.secondary.username, TEST_USERS.secondary.password);
    const user3 = await registerUser(TEST_USERS.tertiary.username, TEST_USERS.tertiary.password);

    const groupResult = await createGroup(
      user1.sessionId,
      '移除测试群',
      [user2.user.id, user3.user.id],
    );

    const groupId = groupResult.group.id;

    // 通过 API 移除 user3
    const { request } = await import('@playwright/test');
    const ctx = await request.newContext({
      baseURL: 'http://localhost:3001',
      extraHTTPHeaders: { 'x-session-id': user1.sessionId },
    });
    const removeRes = await ctx.delete(`/api/group/${groupId}/members/${user3.user.id}`);
    expect(removeRes.status()).toBe(200);
    await ctx.dispose();

    // 通过 API 检查 user3 看不到群组
    const ctx2 = await request.newContext({
      baseURL: 'http://localhost:3001',
      extraHTTPHeaders: { 'x-session-id': user3.sessionId },
    });
    const convRes = await ctx2.get('/api/chat/conversations');
    const convBody = await convRes.json();
    await ctx2.dispose();

    const hasGroup = convBody.conversations.some((c: any) => c.type === 'group');
    expect(hasGroup).toBe(false);
  });

  test('5.4.1: 成员退出群聊 → 退出者看不到群组 (API)', async () => {
    await flushTestData();
    const user1 = await registerUser(TEST_USERS.primary.username, TEST_USERS.primary.password);
    const user2 = await registerUser(TEST_USERS.secondary.username, TEST_USERS.secondary.password);
    const user3 = await registerUser(TEST_USERS.tertiary.username, TEST_USERS.tertiary.password);

    const groupResult = await createGroup(
      user1.sessionId,
      '退出测试群',
      [user2.user.id, user3.user.id],
    );
    const groupId = groupResult.group.id;

    // user2 退出群聊
    const { request } = await import('@playwright/test');
    const ctx = await request.newContext({
      baseURL: 'http://localhost:3001',
      extraHTTPHeaders: { 'x-session-id': user2.sessionId },
    });
    const leaveRes = await ctx.post(`/api/group/${groupId}/leave`);
    expect(leaveRes.status()).toBe(200);
    await ctx.dispose();

    // user2 应该看不到群组
    const ctx2 = await request.newContext({
      baseURL: 'http://localhost:3001',
      extraHTTPHeaders: { 'x-session-id': user2.sessionId },
    });
    const convRes = await ctx2.get('/api/chat/conversations');
    const convBody = await convRes.json();
    await ctx2.dispose();

    const hasGroup = convBody.conversations.some((c: any) => c.type === 'group');
    expect(hasGroup).toBe(false);
  });

  test('5.4.2: 群主解散群组 → 所有成员看不到群组 (API)', async () => {
    await flushTestData();
    const user1 = await registerUser(TEST_USERS.primary.username, TEST_USERS.primary.password);
    const user2 = await registerUser(TEST_USERS.secondary.username, TEST_USERS.secondary.password);
    const user3 = await registerUser(TEST_USERS.tertiary.username, TEST_USERS.tertiary.password);

    const groupResult = await createGroup(
      user1.sessionId,
      '解散测试群',
      [user2.user.id, user3.user.id],
    );
    const groupId = groupResult.group.id;

    // 群主解散群组
    const { request } = await import('@playwright/test');
    const ctx = await request.newContext({
      baseURL: 'http://localhost:3001',
      extraHTTPHeaders: { 'x-session-id': user1.sessionId },
    });
    const dissolveRes = await ctx.delete(`/api/group/${groupId}`);
    expect(dissolveRes.status()).toBe(200);
    await ctx.dispose();

    // 所有成员都看不到群组
    for (const session of [user1.sessionId, user2.sessionId, user3.sessionId]) {
      const ctx2 = await request.newContext({
        baseURL: 'http://localhost:3001',
        extraHTTPHeaders: { 'x-session-id': session },
      });
      const convRes = await ctx2.get('/api/chat/conversations');
      const convBody = await convRes.json();
      await ctx2.dispose();

      const hasGroup = convBody.conversations.some((c: any) => c.id === groupId);
      expect(hasGroup).toBe(false);
    }
  });

  test('5.3.2: 群主邀请新成员 → 新成员看到群组 (API)', async () => {
    await flushTestData();
    const user1 = await registerUser(TEST_USERS.primary.username, TEST_USERS.primary.password);
    const user2 = await registerUser(TEST_USERS.secondary.username, TEST_USERS.secondary.password);
    const user3 = await registerUser(TEST_USERS.tertiary.username, TEST_USERS.tertiary.password);

    // 先创建只有 user1 + user2 的群
    const groupResult = await createGroup(user1.sessionId, '邀请测试群', [user2.user.id]);
    const groupId = groupResult.group.id;

    // 邀请 user3
    const { request } = await import('@playwright/test');
    const ctx = await request.newContext({
      baseURL: 'http://localhost:3001',
      extraHTTPHeaders: { 'x-session-id': user1.sessionId },
    });
    const addRes = await ctx.post(`/api/group/${groupId}/members`, {
      data: { userId: user3.user.id },
    });
    expect(addRes.status()).toBe(200);
    await ctx.dispose();

    // user3 应该能看到群组
    const ctx2 = await request.newContext({
      baseURL: 'http://localhost:3001',
      extraHTTPHeaders: { 'x-session-id': user3.sessionId },
    });
    const convRes = await ctx2.get('/api/chat/conversations');
    const convBody = await convRes.json();
    await ctx2.dispose();

    const hasGroup = convBody.conversations.some((c: any) => c.type === 'group');
    expect(hasGroup).toBe(true);
  });
});
