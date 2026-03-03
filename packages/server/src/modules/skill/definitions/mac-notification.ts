/**
 * Mac 通知 Skill 定义
 *
 * 通过 Electron Notification API 发送系统通知。
 */
import type { SkillDefinition } from '@chat/shared';

export const macNotificationSkill: SkillDefinition = {
  name: 'mac:notification',
  displayName: 'Mac 系统通知',
  description: '在 macOS 上发送系统桌面通知',
  platform: 'mac',
  permission: 'write',
  actions: [
    {
      functionName: 'mac_notification_send',
      description: '发送一条系统桌面通知',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: '通知标题',
          },
          body: {
            type: 'string',
            description: '通知正文',
          },
        },
        required: ['title', 'body'],
      },
    },
  ],
};
