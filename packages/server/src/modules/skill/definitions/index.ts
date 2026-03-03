/**
 * 内置 Skill 定义统一注册
 *
 * 将所有内置 Skill 定义注册到 SkillRegistry。
 */
import type { SkillRegistry } from '../SkillRegistry';
import { macNotesSkill } from './mac-notes';
import { macCalendarSkill } from './mac-calendar';
import { macRemindersSkill } from './mac-reminders';
import { macFinderSkill } from './mac-finder';
import { macPhotosSkill } from './mac-photos';
import { macClipboardSkill } from './mac-clipboard';
import { macShellSkill } from './mac-shell';
import { macBrowserSkill } from './mac-browser';
import { macSystemInfoSkill } from './mac-system-info';
import { macNotificationSkill } from './mac-notification';

/** 注册所有内置 Skill */
export function registerBuiltinSkills(registry: SkillRegistry): void {
  registry.register(macNotesSkill);
  registry.register(macCalendarSkill);
  registry.register(macRemindersSkill);
  registry.register(macFinderSkill);
  registry.register(macPhotosSkill);
  registry.register(macClipboardSkill);
  registry.register(macShellSkill);
  registry.register(macBrowserSkill);
  registry.register(macSystemInfoSkill);
  registry.register(macNotificationSkill);
}
