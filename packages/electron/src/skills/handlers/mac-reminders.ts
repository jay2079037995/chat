/**
 * Mac 提醒事项 Skill 执行器
 */
import { runAppleScript } from './utils';

export async function mac_reminders_list(params: Record<string, unknown>): Promise<unknown> {
  const list = params.list as string | undefined;
  const showCompleted = params.showCompleted === 'true';

  let script: string;
  if (list) {
    script = showCompleted
      ? `tell application "Reminders" to get name of every reminder of list "${list}"`
      : `tell application "Reminders" to get name of (every reminder of list "${list}" whose completed is false)`;
  } else {
    script = showCompleted
      ? `tell application "Reminders" to get name of every reminder`
      : `tell application "Reminders" to get name of (every reminder whose completed is false)`;
  }

  const output = await runAppleScript(script);
  return { reminders: output.split(', ').filter(Boolean) };
}

export async function mac_reminders_create(params: Record<string, unknown>): Promise<unknown> {
  const title = params.title as string;
  const list = (params.list as string) || '提醒事项';
  const notes = (params.notes as string) || '';
  const dueDate = params.dueDate as string | undefined;

  let props = `{name:"${title}", body:"${notes}"}`;
  if (dueDate) {
    props = `{name:"${title}", body:"${notes}", due date:date "${dueDate}"}`;
  }

  const script = `tell application "Reminders" to make new reminder at list "${list}" with properties ${props}`;
  await runAppleScript(script);
  return { created: true, title };
}

export async function mac_reminders_complete(params: Record<string, unknown>): Promise<unknown> {
  const title = params.title as string;
  const list = params.list as string | undefined;

  const target = list ? `of list "${list}"` : '';
  const script = `tell application "Reminders" to set completed of (first reminder ${target} whose name is "${title}") to true`;
  await runAppleScript(script);
  return { completed: true, title };
}

export async function mac_reminders_delete(params: Record<string, unknown>): Promise<unknown> {
  const title = params.title as string;
  const list = params.list as string | undefined;

  const target = list ? `of list "${list}"` : '';
  const script = `tell application "Reminders" to delete (first reminder ${target} whose name is "${title}")`;
  await runAppleScript(script);
  return { deleted: true, title };
}
