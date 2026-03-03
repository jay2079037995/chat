/**
 * registerSW 单元测试 (v1.9.0)
 *
 * 验证 Service Worker 注册、更新检测和更新应用逻辑。
 */

describe('registerSW', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.resetModules();
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: jest.fn(),
        controller: null,
        addEventListener: jest.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it('开发环境不注册', () => {
    process.env.NODE_ENV = 'development';
    const { registerServiceWorker } = require('../src/registerSW');
    registerServiceWorker();
    expect(navigator.serviceWorker.register).not.toHaveBeenCalled();
  });

  it('生产环境注册 /service-worker.js', async () => {
    process.env.NODE_ENV = 'production';

    const mockReg = {
      scope: '/',
      installing: null,
      onupdatefound: null,
      update: jest.fn(),
    };
    (navigator.serviceWorker.register as jest.Mock).mockResolvedValue(mockReg);

    const { registerServiceWorker } = require('../src/registerSW');
    registerServiceWorker();

    window.dispatchEvent(new Event('load'));
    await new Promise((r) => setTimeout(r, 10));

    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/service-worker.js');
  });

  it('不支持 serviceWorker 时静默跳过', () => {
    process.env.NODE_ENV = 'production';
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { registerServiceWorker } = require('../src/registerSW');
    // 不应抛出错误
    expect(() => registerServiceWorker()).not.toThrow();
  });

  it('新 SW installed 时触发 onSWUpdate 回调', async () => {
    process.env.NODE_ENV = 'production';

    const mockReg: Record<string, unknown> = {
      scope: '/',
      installing: null,
      onupdatefound: null,
      update: jest.fn(),
    };
    (navigator.serviceWorker.register as jest.Mock).mockResolvedValue(mockReg);
    Object.defineProperty(navigator.serviceWorker, 'controller', {
      value: {},
      writable: true,
      configurable: true,
    });

    const { registerServiceWorker, onSWUpdate } = require('../src/registerSW');
    const cb = jest.fn();
    onSWUpdate(cb);

    registerServiceWorker();
    window.dispatchEvent(new Event('load'));
    await new Promise((r) => setTimeout(r, 10));

    const mockWorker = { state: 'installed', onstatechange: null as (() => void) | null };
    mockReg.installing = mockWorker;
    (mockReg.onupdatefound as (() => void) | null)?.();
    mockWorker.onstatechange?.();

    expect(cb).toHaveBeenCalledWith(mockReg);
  });

  it('applyUpdate 发送 SKIP_WAITING 消息', () => {
    const mockWaiting = { postMessage: jest.fn() };
    const mockReg = { waiting: mockWaiting };

    const { applyUpdate } = require('../src/registerSW');
    applyUpdate(mockReg);

    expect(mockWaiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });
});
