/**
 * Service Worker 注册与更新管理
 *
 * 在生产环境中注册 Workbox 生成的 Service Worker，
 * 监听更新事件并提示用户刷新页面。
 */

/** SW 更新回调类型 */
type UpdateCallback = (registration: ServiceWorkerRegistration) => void;

/** 存储更新回调 */
let onUpdateCallback: UpdateCallback | null = null;

/**
 * 设置 SW 更新回调
 */
export function onSWUpdate(cb: UpdateCallback): void {
  onUpdateCallback = cb;
}

/**
 * 注册 Service Worker
 *
 * 仅在生产环境且浏览器支持 serviceWorker 时注册。
 * 注册后每 30 分钟检查更新，发现新版本时通知用户。
 */
export function registerServiceWorker(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('[SW] 注册成功, scope:', registration.scope);

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // 有新版本 SW 等待激活
              console.log('[SW] 新版本可用');
              onUpdateCallback?.(registration);
            } else {
              console.log('[SW] 首次安装完成');
            }
          }
        };
      };

      // 每 30 分钟检查更新
      setInterval(() => {
        void registration.update();
      }, 30 * 60 * 1000);
    } catch (error) {
      console.error('[SW] 注册失败:', error);
    }
  });
}

/**
 * 跳过等待并激活新 Service Worker
 */
export function applyUpdate(registration: ServiceWorkerRegistration): void {
  const waitingWorker = registration.waiting;
  if (waitingWorker) {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }
}
