/**
 * Mac 系统信息 Skill 定义
 *
 * 通过 Shell 命令获取 macOS 系统状态信息。
 */
import type { SkillDefinition } from '@chat/shared';

export const macSystemInfoSkill: SkillDefinition = {
  name: 'mac:system-info',
  displayName: 'Mac 系统信息',
  description: '获取 macOS 系统的 CPU、内存、磁盘和网络状态',
  platform: 'mac',
  permission: 'read',
  version: '1.0.0',
  license: 'Apache-2.0',
  author: 'chat-app',
  tags: ['mac', 'system', 'monitoring'],
  actions: [
    {
      functionName: 'mac_system_info_cpu',
      description: '获取 CPU 使用率和型号信息',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    {
      functionName: 'mac_system_info_memory',
      description: '获取内存使用情况（已用/可用/总量）',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    {
      functionName: 'mac_system_info_disk',
      description: '获取磁盘使用情况（各挂载点的已用/可用/总量）',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    {
      functionName: 'mac_system_info_network',
      description: '获取网络接口信息和当前连接状态',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  ],
};
