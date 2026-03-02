/**
 * 浏览器通知工具
 *
 * 封装 Notification API，当用户不在当前会话窗口时弹出桌面通知。
 */

/** 请求浏览器通知权限 */
export function requestNotificationPermission(): void {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

/** 显示浏览器通知 */
export function showBrowserNotification(
  title: string,
  body: string,
  conversationId: string,
): void {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const notification = new Notification(title, {
    body: body.length > 100 ? body.slice(0, 100) + '...' : body,
    icon: '/favicon.ico',
    tag: conversationId, // 同一会话合并通知
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
    // 选择对应会话
    import('../stores/useChatStore').then(({ useChatStore }) => {
      void useChatStore.getState().selectConversation(conversationId);
    });
  };
}
