/**
 * Mac 浏览器 Skill 定义
 *
 * 通过 AppleScript 操控 macOS 默认浏览器（Safari / Chrome）。
 */
import type { SkillDefinition } from '@chat/shared';

export const macBrowserSkill: SkillDefinition = {
  name: 'mac:browser',
  displayName: 'Mac 浏览器',
  description: '打开 URL、获取当前浏览器标签页信息',
  platform: 'mac',
  permission: 'read',
  version: '1.0.0',
  license: 'Apache-2.0',
  author: 'chat-app',
  tags: ['mac', 'browser', 'web'],
  actions: [
    {
      functionName: 'mac_browser_open_url',
      description: '在默认浏览器中打开指定 URL',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: '要打开的 URL 地址',
          },
        },
        required: ['url'],
      },
      permission: 'execute',
    },
    {
      functionName: 'mac_browser_get_tabs',
      description: '获取当前浏览器所有打开的标签页（标题和 URL）',
      parameters: {
        type: 'object',
        properties: {
          browser: {
            type: 'string',
            description: '浏览器名称（Safari / Google Chrome，默认 Safari）',
            enum: ['Safari', 'Google Chrome'],
          },
        },
      },
    },
  ],
};
