/**
 * Skill Handler 注册表
 *
 * 将函数名映射到对应的执行函数。
 */
import * as macNotes from './mac-notes';
import * as macCalendar from './mac-calendar';
import * as macReminders from './mac-reminders';
import * as macFinder from './mac-finder';
import * as macPhotos from './mac-photos';
import * as macClipboard from './mac-clipboard';
import * as macShell from './mac-shell';
import * as macBrowser from './mac-browser';
import * as macSystemInfo from './mac-system-info';
import * as macNotification from './mac-notification';

/** Handler 函数类型 */
export type SkillHandler = (params: Record<string, unknown>) => Promise<unknown>;

/** 函数名 → 执行器映射 */
export const handlers: Record<string, SkillHandler> = {
  // 备忘录
  mac_notes_list: macNotes.mac_notes_list,
  mac_notes_read: macNotes.mac_notes_read,
  mac_notes_create: macNotes.mac_notes_create,
  mac_notes_update: macNotes.mac_notes_update,
  mac_notes_delete: macNotes.mac_notes_delete,
  mac_notes_search: macNotes.mac_notes_search,
  // 日历
  mac_calendar_list: macCalendar.mac_calendar_list,
  mac_calendar_create: macCalendar.mac_calendar_create,
  mac_calendar_delete: macCalendar.mac_calendar_delete,
  // 提醒事项
  mac_reminders_list: macReminders.mac_reminders_list,
  mac_reminders_create: macReminders.mac_reminders_create,
  mac_reminders_complete: macReminders.mac_reminders_complete,
  mac_reminders_delete: macReminders.mac_reminders_delete,
  // 文件管理
  mac_finder_search: macFinder.mac_finder_search,
  mac_finder_open: macFinder.mac_finder_open,
  mac_finder_move: macFinder.mac_finder_move,
  mac_finder_copy: macFinder.mac_finder_copy,
  mac_finder_compress: macFinder.mac_finder_compress,
  mac_finder_info: macFinder.mac_finder_info,
  // 照片
  mac_photos_list_albums: macPhotos.mac_photos_list_albums,
  mac_photos_search: macPhotos.mac_photos_search,
  mac_photos_export: macPhotos.mac_photos_export,
  // 剪贴板
  mac_clipboard_read: macClipboard.mac_clipboard_read,
  mac_clipboard_write: macClipboard.mac_clipboard_write,
  // Shell
  mac_shell_exec: macShell.mac_shell_exec,
  // 浏览器
  mac_browser_open_url: macBrowser.mac_browser_open_url,
  mac_browser_get_tabs: macBrowser.mac_browser_get_tabs,
  // 系统信息
  mac_system_info_cpu: macSystemInfo.mac_system_info_cpu,
  mac_system_info_memory: macSystemInfo.mac_system_info_memory,
  mac_system_info_disk: macSystemInfo.mac_system_info_disk,
  mac_system_info_network: macSystemInfo.mac_system_info_network,
  // 通知
  mac_notification_send: macNotification.mac_notification_send,
};

/** 函数名 → 权限级别映射 */
export const permissionMap: Record<string, 'read' | 'write' | 'execute' | 'dangerous'> = {
  // read 级别
  mac_notes_list: 'read',
  mac_notes_read: 'read',
  mac_notes_search: 'read',
  mac_calendar_list: 'read',
  mac_reminders_list: 'read',
  mac_finder_search: 'read',
  mac_finder_info: 'read',
  mac_photos_list_albums: 'read',
  mac_photos_search: 'read',
  mac_photos_export: 'read',
  mac_clipboard_read: 'read',
  mac_browser_get_tabs: 'read',
  mac_system_info_cpu: 'read',
  mac_system_info_memory: 'read',
  mac_system_info_disk: 'read',
  mac_system_info_network: 'read',
  // write 级别
  mac_notes_create: 'write',
  mac_notes_update: 'write',
  mac_notes_delete: 'write',
  mac_calendar_create: 'write',
  mac_calendar_delete: 'write',
  mac_reminders_create: 'write',
  mac_reminders_complete: 'write',
  mac_reminders_delete: 'write',
  mac_clipboard_write: 'write',
  mac_notification_send: 'write',
  // execute 级别
  mac_finder_open: 'execute',
  mac_finder_move: 'execute',
  mac_finder_copy: 'execute',
  mac_finder_compress: 'execute',
  mac_browser_open_url: 'execute',
  // dangerous 级别
  mac_shell_exec: 'dangerous',
};
