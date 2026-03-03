/**
 * Mac 照片 Skill 执行器
 */
import { runAppleScript } from './utils';

export async function mac_photos_list_albums(): Promise<unknown> {
  const script = `tell application "Photos" to get name of every album`;
  const output = await runAppleScript(script);
  return { albums: output.split(', ').filter(Boolean) };
}

export async function mac_photos_search(params: Record<string, unknown>): Promise<unknown> {
  const query = params.query as string;
  const limit = (params.limit as number) || 20;
  const album = params.album as string | undefined;

  let script: string;
  if (album) {
    script = `
      tell application "Photos"
        set a to album "${album}"
        set results to {}
        repeat with p in (every media item of a)
          if name of p contains "${query}" or description of p contains "${query}" then
            set end of results to (id of p) & " | " & (name of p)
          end if
          if (count of results) >= ${limit} then exit repeat
        end repeat
        return results
      end tell
    `;
  } else {
    script = `
      tell application "Photos"
        set results to {}
        repeat with p in (every media item)
          if name of p contains "${query}" then
            set end of results to (id of p) & " | " & (name of p)
          end if
          if (count of results) >= ${limit} then exit repeat
        end repeat
        return results
      end tell
    `;
  }

  const output = await runAppleScript(script);
  return { photos: output.split(', ').filter(Boolean) };
}

export async function mac_photos_export(params: Record<string, unknown>): Promise<unknown> {
  const photoId = params.photoId as string;
  const outputDir = params.outputDir as string;

  const script = `
    tell application "Photos"
      set p to media item id "${photoId}"
      export {p} to POSIX file "${outputDir}"
    end tell
  `;
  await runAppleScript(script);
  return { exported: true, photoId, outputDir };
}
