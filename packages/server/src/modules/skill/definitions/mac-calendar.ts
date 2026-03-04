/**
 * Mac 日历 Skill 定义
 *
 * 通过 AppleScript 操控 macOS 日历应用。
 */
import type { SkillDefinition } from '@chat/shared';

export const macCalendarSkill: SkillDefinition = {
  name: 'mac:calendar',
  displayName: 'Mac 日历',
  description: '查看、创建和删除 macOS 日历事件',
  platform: 'mac',
  permission: 'read',
  version: '1.0.0',
  license: 'Apache-2.0',
  author: 'chat-app',
  tags: ['mac', 'calendar', 'productivity'],
  actions: [
    {
      functionName: 'mac_calendar_list',
      description: '列出指定日期范围内的日历事件',
      parameters: {
        type: 'object',
        properties: {
          startDate: {
            type: 'string',
            description: '开始日期（ISO 格式，如 2025-01-01）',
          },
          endDate: {
            type: 'string',
            description: '结束日期（ISO 格式，如 2025-01-31）',
          },
          calendar: {
            type: 'string',
            description: '日历名称（可选，默认查看所有日历）',
          },
        },
        required: ['startDate', 'endDate'],
      },
    },
    {
      functionName: 'mac_calendar_create',
      description: '创建新的日历事件',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: '事件标题',
          },
          startDate: {
            type: 'string',
            description: '开始时间（ISO 格式，如 2025-01-01T09:00:00）',
          },
          endDate: {
            type: 'string',
            description: '结束时间（ISO 格式，如 2025-01-01T10:00:00）',
          },
          location: {
            type: 'string',
            description: '事件地点（可选）',
          },
          notes: {
            type: 'string',
            description: '事件备注（可选）',
          },
          calendar: {
            type: 'string',
            description: '目标日历名称（可选）',
          },
        },
        required: ['title', 'startDate', 'endDate'],
      },
      permission: 'write',
    },
    {
      functionName: 'mac_calendar_delete',
      description: '删除指定日历事件',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: '事件标题',
          },
          date: {
            type: 'string',
            description: '事件所在日期（ISO 格式）',
          },
        },
        required: ['title', 'date'],
      },
      permission: 'write',
    },
  ],
};
