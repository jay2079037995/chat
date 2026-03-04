/**
 * Mac 提醒事项 Skill 定义
 *
 * 通过 AppleScript 操控 macOS 提醒事项应用。
 */
import type { SkillDefinition } from '@chat/shared';

export const macRemindersSkill: SkillDefinition = {
  name: 'mac:reminders',
  displayName: 'Mac 提醒事项',
  description: '查看、创建、完成和删除 macOS 提醒事项',
  platform: 'mac',
  permission: 'read',
  version: '1.0.0',
  license: 'Apache-2.0',
  author: 'chat-app',
  tags: ['mac', 'reminders', 'productivity'],
  actions: [
    {
      functionName: 'mac_reminders_list',
      description: '列出提醒事项（可按列表筛选）',
      parameters: {
        type: 'object',
        properties: {
          list: {
            type: 'string',
            description: '提醒事项列表名称（可选，默认查看所有列表）',
          },
          showCompleted: {
            type: 'string',
            description: '是否显示已完成的提醒（true/false，默认 false）',
            default: 'false',
          },
        },
      },
    },
    {
      functionName: 'mac_reminders_create',
      description: '创建新的提醒事项',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: '提醒标题',
          },
          dueDate: {
            type: 'string',
            description: '到期日期（ISO 格式，可选）',
          },
          list: {
            type: 'string',
            description: '目标列表名称（可选）',
          },
          notes: {
            type: 'string',
            description: '备注（可选）',
          },
        },
        required: ['title'],
      },
      permission: 'write',
    },
    {
      functionName: 'mac_reminders_complete',
      description: '将提醒事项标记为已完成',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: '提醒标题',
          },
          list: {
            type: 'string',
            description: '列表名称（可选，帮助精确匹配）',
          },
        },
        required: ['title'],
      },
      permission: 'write',
    },
    {
      functionName: 'mac_reminders_delete',
      description: '删除指定提醒事项',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: '提醒标题',
          },
          list: {
            type: 'string',
            description: '列表名称（可选，帮助精确匹配）',
          },
        },
        required: ['title'],
      },
      permission: 'write',
    },
  ],
};
