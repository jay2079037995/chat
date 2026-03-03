/**
 * BotTrustStore + PermissionManager 信任机制测试
 *
 * 验证 Bot 信任配置的 CRUD 操作和信任链集成。
 * 使用 mock 替代 electron-store 和 electron dialog。
 */

// Mock electron-store
const mockStoreData: Record<string, any> = {};
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation((opts?: { name?: string; defaults?: any }) => {
    const storeName = opts?.name || 'default';
    if (!mockStoreData[storeName]) {
      mockStoreData[storeName] = { ...(opts?.defaults || {}) };
    }
    return {
      get: (key: string) => mockStoreData[storeName][key],
      set: (key: string, value: any) => { mockStoreData[storeName][key] = value; },
    };
  });
});

// Mock electron dialog 和 window
const mockShowMessageBox = jest.fn().mockResolvedValue({ response: 0 });
jest.mock('electron', () => ({
  app: {
    getPath: () => '/mock/userData',
  },
  dialog: {
    showMessageBox: (...args: any[]) => mockShowMessageBox(...args),
  },
}));

jest.mock('../src/windowManager', () => ({
  getMainWindow: () => ({ isDestroyed: () => false }),
}));

import { BotTrustStore } from '../src/skills/BotTrustStore';
import { PermissionManager } from '../src/skills/PermissionManager';

describe('BotTrustStore', () => {
  let store: BotTrustStore;

  beforeEach(() => {
    // 清理 mock 数据
    for (const key of Object.keys(mockStoreData)) {
      delete mockStoreData[key];
    }
    store = new BotTrustStore();
  });

  test('新 Bot 默认不受信任', () => {
    expect(store.isTrusted('bot-1')).toBe(false);
  });

  test('设置 Bot 为受信任', () => {
    store.setTrust('bot-1', 'test_bot', true);
    expect(store.isTrusted('bot-1')).toBe(true);
  });

  test('设置 Bot 为不受信任', () => {
    store.setTrust('bot-1', 'test_bot', true);
    store.setTrust('bot-1', 'test_bot', false);
    expect(store.isTrusted('bot-1')).toBe(false);
  });

  test('列出所有信任配置', () => {
    store.setTrust('bot-1', 'bot_one', true);
    store.setTrust('bot-2', 'bot_two', false);
    const configs = store.listTrustConfigs();
    expect(configs).toHaveLength(2);
    expect(configs.find((c) => c.botId === 'bot-1')?.trusted).toBe(true);
    expect(configs.find((c) => c.botId === 'bot-2')?.trusted).toBe(false);
  });

  test('移除 Bot 信任配置', () => {
    store.setTrust('bot-1', 'test_bot', true);
    store.removeTrust('bot-1');
    expect(store.isTrusted('bot-1')).toBe(false);
    expect(store.listTrustConfigs()).toHaveLength(0);
  });
});

describe('PermissionManager Bot 信任集成', () => {
  let trustStore: BotTrustStore;
  let permManager: PermissionManager;

  beforeEach(() => {
    for (const key of Object.keys(mockStoreData)) {
      delete mockStoreData[key];
    }
    mockShowMessageBox.mockClear().mockResolvedValue({ response: 0 });
    trustStore = new BotTrustStore();
    permManager = new PermissionManager(trustStore);
  });

  test('read 权限始终放行', async () => {
    const result = await permManager.checkPermission('test_fn', 'read');
    expect(result).toBe(true);
    expect(mockShowMessageBox).not.toHaveBeenCalled();
  });

  test('受信 Bot 的 dangerous 操作自动放行', async () => {
    trustStore.setTrust('bot-1', 'trusted_bot', true);
    const result = await permManager.checkPermission('shell_exec', 'dangerous', 'rm -rf /', 'bot-1');
    expect(result).toBe(true);
    expect(mockShowMessageBox).not.toHaveBeenCalled();
  });

  test('受信 Bot 的 write 操作自动放行', async () => {
    trustStore.setTrust('bot-1', 'trusted_bot', true);
    const result = await permManager.checkPermission('write_fn', 'write', undefined, 'bot-1');
    expect(result).toBe(true);
    expect(mockShowMessageBox).not.toHaveBeenCalled();
  });

  test('不受信 Bot 的 dangerous 操作弹窗（用户拒绝）', async () => {
    mockShowMessageBox.mockResolvedValueOnce({ response: 0 }); // 拒绝
    const result = await permManager.checkPermission('shell_exec', 'dangerous', 'rm -rf /', 'bot-2');
    expect(result).toBe(false);
    expect(mockShowMessageBox).toHaveBeenCalled();
  });

  test('不受信 Bot 的 write 操作弹窗（用户允许）', async () => {
    mockShowMessageBox.mockResolvedValueOnce({ response: 1 }); // 允许本次
    const result = await permManager.checkPermission('write_fn', 'write', undefined, 'bot-2');
    expect(result).toBe(true);
    expect(mockShowMessageBox).toHaveBeenCalled();
  });

  test('无 botId 时 dangerous 操作需弹窗', async () => {
    mockShowMessageBox.mockResolvedValueOnce({ response: 1 }); // 允许
    const result = await permManager.checkPermission('shell_exec', 'dangerous', 'ls');
    expect(result).toBe(true);
    expect(mockShowMessageBox).toHaveBeenCalled();
  });

  test('dangerous 操作选择"本次会话始终允许"后不再弹窗', async () => {
    mockShowMessageBox.mockResolvedValueOnce({ response: 2 }); // 本次会话始终允许
    const r1 = await permManager.checkPermission('shell_exec', 'dangerous', 'ls');
    expect(r1).toBe(true);
    expect(mockShowMessageBox).toHaveBeenCalledTimes(1);

    // 第二次调用不再弹窗
    const r2 = await permManager.checkPermission('shell_exec', 'dangerous', 'pwd');
    expect(r2).toBe(true);
    expect(mockShowMessageBox).toHaveBeenCalledTimes(1); // 仍然只有 1 次
  });
});
