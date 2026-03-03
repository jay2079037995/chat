/**
 * Mac 剪贴板 Skill 执行器
 *
 * 使用 Electron clipboard API。
 */
import { clipboard } from 'electron';

export async function mac_clipboard_read(): Promise<unknown> {
  const text = clipboard.readText();
  return { text };
}

export async function mac_clipboard_write(params: Record<string, unknown>): Promise<unknown> {
  const text = params.text as string;
  clipboard.writeText(text);
  return { written: true };
}
