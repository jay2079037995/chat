/**
 * Mac 备忘录 Skill 执行器
 *
 * 通过 AppleScript 操控 macOS 备忘录应用。
 */
import { exec } from './utils';

export async function mac_notes_list(params: Record<string, unknown>): Promise<unknown> {
  const limit = (params.limit as number) || 50;
  const folder = params.folder as string | undefined;

  let script: string;
  if (folder) {
    script = `tell application "Notes" to get name of notes of folder "${folder}"`;
  } else {
    script = `tell application "Notes" to get name of every note`;
  }

  const output = await exec(`osascript -e '${script}'`);
  const names = output.split(', ').slice(0, limit);
  return { notes: names.map((n: string) => n.trim()).filter(Boolean) };
}

export async function mac_notes_read(params: Record<string, unknown>): Promise<unknown> {
  const name = params.name as string;
  const script = `tell application "Notes" to get body of note "${name}"`;
  const body = await exec(`osascript -e '${script}'`);
  return { title: name, body: body.trim() };
}

export async function mac_notes_create(params: Record<string, unknown>): Promise<unknown> {
  const title = params.title as string;
  const body = params.body as string;
  const folder = (params.folder as string) || '备忘录';

  const escapedBody = body.replace(/"/g, '\\"');
  const script = `tell application "Notes" to make new note at folder "${folder}" with properties {name:"${title}", body:"${escapedBody}"}`;
  await exec(`osascript -e '${script}'`);
  return { created: true, title };
}

export async function mac_notes_update(params: Record<string, unknown>): Promise<unknown> {
  const name = params.name as string;
  const body = params.body as string;
  const escapedBody = body.replace(/"/g, '\\"');
  const script = `tell application "Notes" to set body of note "${name}" to "${escapedBody}"`;
  await exec(`osascript -e '${script}'`);
  return { updated: true, title: name };
}

export async function mac_notes_delete(params: Record<string, unknown>): Promise<unknown> {
  const name = params.name as string;
  const script = `tell application "Notes" to delete note "${name}"`;
  await exec(`osascript -e '${script}'`);
  return { deleted: true, title: name };
}

export async function mac_notes_search(params: Record<string, unknown>): Promise<unknown> {
  const query = params.query as string;
  const script = `tell application "Notes" to get name of every note whose name contains "${query}" or body contains "${query}"`;
  const output = await exec(`osascript -e '${script}'`);
  const names = output.split(', ').map((n: string) => n.trim()).filter(Boolean);
  return { results: names };
}
