/**
 * Mastra Tool 桥接器
 *
 * 将现有 Skill handler 转换为 Mastra createTool() 格式，
 * 供 LocalBotManager 的 Mastra Agent 使用。
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { handlers, type SkillHandler } from '../skills/handlers';
import type { SkillPackageManager } from '../skills/SkillPackageManager';

/** 自定义 Skill 包管理器引用（由 main.ts 注入） */
let packageManager: SkillPackageManager | null = null;

/** 注入 SkillPackageManager（由 main.ts 在启动时调用） */
export function setPackageManager(pm: SkillPackageManager): void {
  packageManager = pm;
}

/** 所有 Skill handler 的描述信息 */
const TOOL_DESCRIPTIONS: Record<string, { name: string; description: string }> = {
  // 备忘录
  mac_notes_list: { name: '列出备忘录', description: '列出 macOS 备忘录应用中的所有备忘录' },
  mac_notes_read: { name: '读取备忘录', description: '读取指定备忘录的内容' },
  mac_notes_create: { name: '创建备忘录', description: '创建新的备忘录' },
  mac_notes_update: { name: '更新备忘录', description: '更新指定备忘录的内容' },
  mac_notes_delete: { name: '删除备忘录', description: '删除指定的备忘录' },
  mac_notes_search: { name: '搜索备忘录', description: '搜索备忘录内容' },
  // 日历
  mac_calendar_list: { name: '列出日历事件', description: '列出 macOS 日历中的事件' },
  mac_calendar_create: { name: '创建日历事件', description: '创建新的日历事件' },
  mac_calendar_delete: { name: '删除日历事件', description: '删除指定的日历事件' },
  // 提醒事项
  mac_reminders_list: { name: '列出提醒', description: '列出 macOS 提醒事项' },
  mac_reminders_create: { name: '创建提醒', description: '创建新的提醒事项' },
  mac_reminders_complete: { name: '完成提醒', description: '标记提醒事项为已完成' },
  mac_reminders_delete: { name: '删除提醒', description: '删除指定的提醒事项' },
  // 文件管理
  mac_finder_search: { name: '搜索文件', description: '在 macOS Finder 中搜索文件' },
  mac_finder_open: { name: '打开文件', description: '用默认应用打开文件或目录' },
  mac_finder_move: { name: '移动文件', description: '移动文件到指定位置' },
  mac_finder_copy: { name: '复制文件', description: '复制文件到指定位置' },
  mac_finder_compress: { name: '压缩文件', description: '压缩文件或目录' },
  mac_finder_info: { name: '文件信息', description: '获取文件或目录的详细信息' },
  // 照片
  mac_photos_list_albums: { name: '列出相册', description: '列出 macOS 照片应用中的相册' },
  mac_photos_search: { name: '搜索照片', description: '搜索 macOS 照片应用中的照片' },
  mac_photos_export: { name: '导出照片', description: '导出照片到指定路径' },
  // 剪贴板
  mac_clipboard_read: { name: '读取剪贴板', description: '读取系统剪贴板的文本内容' },
  mac_clipboard_write: { name: '写入剪贴板', description: '将文本写入系统剪贴板' },
  // Shell
  mac_shell_exec: { name: '执行命令', description: '在终端执行 Shell 命令' },
  // 浏览器
  mac_browser_open_url: { name: '打开网页', description: '在默认浏览器中打开 URL' },
  mac_browser_get_tabs: { name: '获取标签页', description: '获取浏览器当前打开的标签页列表' },
  // 系统信息
  mac_system_info_cpu: { name: 'CPU 信息', description: '获取 CPU 使用情况' },
  mac_system_info_memory: { name: '内存信息', description: '获取内存使用情况' },
  mac_system_info_disk: { name: '磁盘信息', description: '获取磁盘使用情况' },
  mac_system_info_network: { name: '网络信息', description: '获取网络接口信息' },
  // 通知
  mac_notification_send: { name: '发送通知', description: '发送 macOS 系统通知' },
};

/**
 * 将一个 Skill handler 包装为 Mastra Tool
 *
 * 使用 z.record(z.any()) 作为通用 input schema，
 * 因为现有 handler 接受 Record<string, unknown>
 */
function wrapHandler(functionName: string, handler: SkillHandler, description: string) {
  return createTool({
    id: functionName,
    description,
    inputSchema: z.record(z.any()),
    execute: async ({ context }: { context: Record<string, any> }) => {
      const result = await handler(context as Record<string, unknown>);
      return result;
    },
  });
}

/** Mastra Tool 信息（用于 UI 展示） */
export interface MastraToolInfo {
  id: string;
  name: string;
  description: string;
}

/** 获取所有可用的 Mastra Tool（内置 + 自定义，已包装） */
export function getAvailableMastraTools(): Record<string, ReturnType<typeof createTool>> {
  const tools: Record<string, ReturnType<typeof createTool>> = {};

  // 1. 内置 Skill handler
  for (const [funcName, handler] of Object.entries(handlers)) {
    const info = TOOL_DESCRIPTIONS[funcName];
    if (info) {
      tools[funcName] = wrapHandler(funcName, handler, info.description);
    }
  }

  // 2. 自定义 Skill（从 SkillPackageManager 获取）
  if (packageManager) {
    for (const skill of packageManager.listCustomSkills()) {
      for (const action of skill.actions) {
        const handler = packageManager.getHandler(action.functionName);
        if (handler) {
          tools[action.functionName] = wrapHandler(
            action.functionName,
            handler,
            action.description || skill.description,
          );
        }
      }
    }
  }

  return tools;
}

/** 按白名单筛选 Mastra Tool */
export function getMastraTools(enabledIds?: string[]): Record<string, ReturnType<typeof createTool>> {
  const all = getAvailableMastraTools();
  if (!enabledIds || enabledIds.includes('*')) return all;

  const filtered: Record<string, ReturnType<typeof createTool>> = {};
  for (const id of enabledIds) {
    if (all[id]) {
      filtered[id] = all[id];
    }
  }
  return filtered;
}

/** 返回所有 Tool 信息列表（内置 + 自定义，供 UI 展示） */
export function listMastraToolInfo(): MastraToolInfo[] {
  // 内置 Skill 信息
  const list: MastraToolInfo[] = Object.entries(TOOL_DESCRIPTIONS).map(([id, info]) => ({
    id,
    name: info.name,
    description: info.description,
  }));

  // 自定义 Skill 信息
  if (packageManager) {
    for (const skill of packageManager.listCustomSkills()) {
      for (const action of skill.actions) {
        list.push({
          id: action.functionName,
          name: action.description || action.functionName,
          description: action.description || skill.description,
        });
      }
    }
  }

  return list;
}
