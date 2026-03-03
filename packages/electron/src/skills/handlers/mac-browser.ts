/**
 * Mac 浏览器 Skill 执行器
 */
import { exec, runAppleScript } from './utils';

export async function mac_browser_open_url(params: Record<string, unknown>): Promise<unknown> {
  const url = params.url as string;
  await exec(`open "${url}"`);
  return { opened: true, url };
}

export async function mac_browser_get_tabs(params: Record<string, unknown>): Promise<unknown> {
  const browser = (params.browser as string) || 'Safari';

  let script: string;
  if (browser === 'Google Chrome') {
    script = `
      tell application "Google Chrome"
        set result to {}
        repeat with w in windows
          repeat with t in tabs of w
            set end of result to (title of t) & " | " & (URL of t)
          end repeat
        end repeat
        return result
      end tell
    `;
  } else {
    script = `
      tell application "Safari"
        set result to {}
        repeat with w in windows
          repeat with t in tabs of w
            set end of result to (name of t) & " | " & (URL of t)
          end repeat
        end repeat
        return result
      end tell
    `;
  }

  const output = await runAppleScript(script);
  return { tabs: output.split(', ').filter(Boolean) };
}
