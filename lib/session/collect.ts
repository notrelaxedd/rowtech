// Turns whatever someone picked -- loose files, a folder, a zip, several
// seats at once -- into one group per node session. Pure, so the upload path
// and the tests exercise the same code.
import { unzipSync } from "fflate";

export type SessionFolder = {
  meta?: Uint8Array;
  strokes?: Uint8Array;
  curves?: Uint8Array;
  events?: Uint8Array;
};

export type NamedFile = { name: string; bytes: Uint8Array };

const WANTED: Record<string, keyof SessionFolder> = {
  "meta.json": "meta",
  "strokes.csv": "strokes",
  "curves.bin": "curves",
  "events.csv": "events",
};

function place(folders: Map<string, SessionFolder>, fullPath: string, bytes: Uint8Array) {
  const parts = fullPath.split(/[\\/]/).filter(Boolean);
  const file = parts.pop()?.toLowerCase() ?? "";
  const key = WANTED[file];
  if (!key) return;
  // Loose files with no folder are all one session; a zip or a picked folder
  // keeps its directory, so several seats stay apart.
  const dir = parts.join("/") || "session";
  const folder = folders.get(dir) ?? {};
  folder[key] = bytes;
  folders.set(dir, folder);
}

/** Groups files by the folder they came from. Zips are expanded first. */
export function collectSessions(files: NamedFile[]): Map<string, SessionFolder> {
  const folders = new Map<string, SessionFolder>();
  for (const { name, bytes } of files) {
    if (!bytes.byteLength) continue;
    if (name.toLowerCase().endsWith(".zip")) {
      const entries = unzipSync(bytes);
      for (const [path, content] of Object.entries(entries)) {
        if (path.endsWith("/") || content.length === 0) continue;
        place(folders, path, content);
      }
    } else {
      place(folders, name, bytes);
    }
  }
  // Only folders that hold a session at all.
  for (const [key, folder] of folders) if (!folder.meta || !folder.strokes) folders.delete(key);
  return folders;
}
