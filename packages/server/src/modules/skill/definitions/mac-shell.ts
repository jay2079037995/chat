/**
 * Mac Shell 命令 Skill 定义
 *
 * 在 Electron 环境中执行 Shell 命令。
 * ⚠️ 权限级别为 dangerous，每次执行必须弹窗确认。
 */
import type { SkillDefinition } from '@chat/shared';

export const macShellSkill: SkillDefinition = {
  name: 'mac:shell',
  displayName: 'Mac Shell',
  description: '在用户电脑上执行 Shell 命令（危险操作，每次需确认）',
  platform: 'mac',
  permission: 'dangerous',
  actions: [
    {
      functionName: 'mac_shell_exec',
      description: '执行一条 Shell 命令并返回输出结果（stdout + stderr）。⚠️ 每次执行都需要用户确认',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: '要执行的 Shell 命令',
          },
          cwd: {
            type: 'string',
            description: '工作目录（可选，默认为用户主目录）',
          },
          timeout: {
            type: 'number',
            description: '超时时间（毫秒，默认 30000）',
            default: 30000,
          },
        },
        required: ['command'],
      },
    },
  ],
};
