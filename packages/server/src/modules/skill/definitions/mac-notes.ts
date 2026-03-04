/**
 * Mac 备忘录 Skill 定义
 *
 * 通过 AppleScript 操控 macOS 备忘录应用。
 */
import type { SkillDefinition } from '@chat/shared';

export const macNotesSkill: SkillDefinition = {
  name: 'mac:notes',
  displayName: 'Mac 备忘录',
  description: '读取、创建、更新、删除和搜索 macOS 备忘录',
  platform: 'mac',
  permission: 'read',
  version: '1.0.0',
  license: 'Apache-2.0',
  author: 'chat-app',
  tags: ['mac', 'notes', 'productivity'],
  actions: [
    {
      functionName: 'mac_notes_list',
      description: '列出所有备忘录（返回标题和 ID 列表）',
      parameters: {
        type: 'object',
        properties: {
          folder: {
            type: 'string',
            description: '文件夹名称（可选，默认列出所有文件夹下的备忘录）',
          },
          limit: {
            type: 'number',
            description: '最大返回条数（默认 50）',
            default: 50,
          },
        },
      },
    },
    {
      functionName: 'mac_notes_read',
      description: '读取指定备忘录的完整内容',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '备忘录标题',
          },
        },
        required: ['name'],
      },
    },
    {
      functionName: 'mac_notes_create',
      description: '创建一条新的备忘录',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: '备忘录标题',
          },
          body: {
            type: 'string',
            description: '备忘录正文内容',
          },
          folder: {
            type: 'string',
            description: '目标文件夹名称（可选，默认放入"备忘录"文件夹）',
          },
        },
        required: ['title', 'body'],
      },
      permission: 'write',
    },
    {
      functionName: 'mac_notes_update',
      description: '更新指定备忘录的内容',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '备忘录标题',
          },
          body: {
            type: 'string',
            description: '新的正文内容',
          },
        },
        required: ['name', 'body'],
      },
      permission: 'write',
    },
    {
      functionName: 'mac_notes_delete',
      description: '删除指定备忘录',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '备忘录标题',
          },
        },
        required: ['name'],
      },
      permission: 'write',
    },
    {
      functionName: 'mac_notes_search',
      description: '按关键词搜索备忘录',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词',
          },
        },
        required: ['query'],
      },
    },
  ],
};
