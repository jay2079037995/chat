/**
 * Mac 系统通知 Skill 执行器
 *
 * 使用 Electron Notification API。
 */
import { Notification } from 'electron';

export async function mac_notification_send(params: Record<string, unknown>): Promise<unknown> {
  const title = params.title as string;
  const body = params.body as string;

  const notification = new Notification({ title, body });
  notification.show();
  return { sent: true };
}
