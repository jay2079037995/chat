/**
 * Mac Finder 文件管理 Skill 定义
 *
 * 通过 AppleScript / Shell 命令操控 macOS 文件系统。
 */
import type { SkillDefinition } from '@chat/shared';

export const macFinderSkill: SkillDefinition = {
  name: 'mac:finder',
  displayName: 'Mac 文件管理',
  description: '搜索、打开、移动、复制和压缩文件',
  platform: 'mac',
  permission: 'read',
  actions: [
    {
      functionName: 'mac_finder_search',
      description: '在指定目录下搜索文件（支持文件名模糊匹配）',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词（文件名）',
          },
          directory: {
            type: 'string',
            description: '搜索目录路径（默认为用户主目录）',
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
      functionName: 'mac_finder_open',
      description: '用默认应用打开指定文件或文件夹',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '文件或文件夹的绝对路径',
          },
        },
        required: ['path'],
      },
      permission: 'execute',
    },
    {
      functionName: 'mac_finder_move',
      description: '移动文件或文件夹到目标路径',
      parameters: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: '源文件路径',
          },
          destination: {
            type: 'string',
            description: '目标路径',
          },
        },
        required: ['source', 'destination'],
      },
      permission: 'execute',
    },
    {
      functionName: 'mac_finder_copy',
      description: '复制文件或文件夹到目标路径',
      parameters: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: '源文件路径',
          },
          destination: {
            type: 'string',
            description: '目标路径',
          },
        },
        required: ['source', 'destination'],
      },
      permission: 'execute',
    },
    {
      functionName: 'mac_finder_compress',
      description: '压缩文件或文件夹为 zip',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '要压缩的文件或文件夹路径',
          },
          outputPath: {
            type: 'string',
            description: '输出 zip 文件路径（可选，默认同目录下）',
          },
        },
        required: ['path'],
      },
      permission: 'execute',
    },
    {
      functionName: 'mac_finder_info',
      description: '获取文件或文件夹的详细信息（大小、修改时间、类型）',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '文件或文件夹的绝对路径',
          },
        },
        required: ['path'],
      },
    },
  ],
};
