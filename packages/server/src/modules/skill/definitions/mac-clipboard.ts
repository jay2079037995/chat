/**
 * Mac 剪贴板 Skill 定义
 *
 * 通过 Electron clipboard API 操控系统剪贴板。
 */
import type { SkillDefinition } from '@chat/shared';

export const macClipboardSkill: SkillDefinition = {
  name: 'mac:clipboard',
  displayName: 'Mac 剪贴板',
  description: '读取和写入 macOS 系统剪贴板',
  platform: 'mac',
  permission: 'read',
  actions: [
    {
      functionName: 'mac_clipboard_read',
      description: '读取剪贴板当前的文本内容',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    {
      functionName: 'mac_clipboard_write',
      description: '将文本写入剪贴板',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: '要写入剪贴板的文本内容',
          },
        },
        required: ['text'],
      },
      permission: 'write',
    },
  ],
};
