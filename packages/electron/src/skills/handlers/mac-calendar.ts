/**
 * Mac 日历 Skill 执行器
 */
import { runAppleScript } from './utils';

export async function mac_calendar_list(params: Record<string, unknown>): Promise<unknown> {
  const startDate = params.startDate as string;
  const endDate = params.endDate as string;
  const calendar = params.calendar as string | undefined;

  const calFilter = calendar ? `of calendar "${calendar}"` : '';
  const script = `
    tell application "Calendar"
      set startD to date "${startDate}"
      set endD to date "${endDate}"
      set evts to every event ${calFilter} whose start date >= startD and start date <= endD
      set result to {}
      repeat with e in evts
        set end of result to (summary of e) & " | " & (start date of e as string) & " - " & (end date of e as string)
      end repeat
      return result
    end tell
  `;
  const output = await runAppleScript(script);
  return { events: output.split(', ').filter(Boolean) };
}

export async function mac_calendar_create(params: Record<string, unknown>): Promise<unknown> {
  const title = params.title as string;
  const startDate = params.startDate as string;
  const endDate = params.endDate as string;
  const location = (params.location as string) || '';
  const notes = (params.notes as string) || '';

  const script = `
    tell application "Calendar"
      tell calendar "日历"
        make new event with properties {summary:"${title}", start date:date "${startDate}", end date:date "${endDate}", location:"${location}", description:"${notes}"}
      end tell
    end tell
  `;
  await runAppleScript(script);
  return { created: true, title };
}

export async function mac_calendar_delete(params: Record<string, unknown>): Promise<unknown> {
  const title = params.title as string;
  const date = params.date as string;

  const script = `
    tell application "Calendar"
      set targetDate to date "${date}"
      repeat with cal in calendars
        set evts to (every event of cal whose summary is "${title}" and start date >= targetDate)
        repeat with e in evts
          delete e
        end repeat
      end repeat
    end tell
  `;
  await runAppleScript(script);
  return { deleted: true, title };
}
