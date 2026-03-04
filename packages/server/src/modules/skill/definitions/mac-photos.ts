/**
 * Mac 照片 Skill 定义
 *
 * 通过 AppleScript 操控 macOS 照片应用。
 */
import type { SkillDefinition } from '@chat/shared';

export const macPhotosSkill: SkillDefinition = {
  name: 'mac:photos',
  displayName: 'Mac 照片',
  description: '浏览相册、搜索和导出 macOS 照片',
  platform: 'mac',
  permission: 'read',
  version: '1.0.0',
  license: 'Apache-2.0',
  author: 'chat-app',
  tags: ['mac', 'photos', 'media'],
  actions: [
    {
      functionName: 'mac_photos_list_albums',
      description: '列出所有照片相册',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    {
      functionName: 'mac_photos_search',
      description: '按关键词搜索照片（匹配标题、描述等元数据）',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词',
          },
          album: {
            type: 'string',
            description: '相册名称（可选，限定搜索范围）',
          },
          limit: {
            type: 'number',
            description: '最大返回条数（默认 20）',
            default: 20,
          },
        },
        required: ['query'],
      },
    },
    {
      functionName: 'mac_photos_export',
      description: '将指定照片导出到目标目录',
      parameters: {
        type: 'object',
        properties: {
          photoId: {
            type: 'string',
            description: '照片 ID（从搜索结果获得）',
          },
          outputDir: {
            type: 'string',
            description: '导出目标目录路径',
          },
        },
        required: ['photoId', 'outputDir'],
      },
    },
  ],
};
