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

/**
 * What one zip may expand to. A session is four files of a few hundred kB, so
 * these are far above any real upload, and far below what a crafted zip (a
 * few MB that declares gigabytes) would otherwise make the server allocate.
 */
export const ZIP_LIMITS = {
  /** Session files taken from one zip: nine seats of four files is 36. */
  files: 64,
  /** Declared size of any one of them. */
  fileBytes: 8 * 1024 * 1024,
  /** Declared size of all of them together. */
  totalBytes: 64 * 1024 * 1024,
};

export class ZipTooLargeError extends Error {
  constructor() {
    super("That zip holds more than one upload can take. Zip one outing's session folders at a time.");
    this.name = "ZipTooLargeError";
  }
}

/** Expands only the session files, refusing a zip that would expand past ZIP_LIMITS. */
function unzipSessionFiles(bytes: Uint8Array) {
  let files = 0;
  let total = 0;
  return unzipSync(bytes, {
    // Runs before anything is inflated, on the sizes the zip declares. fflate
    // never writes more than the declared size, so this bounds the memory.
    filter: (f) => {
      const name = f.name.split(/[\\/]/).pop()?.toLowerCase() ?? "";
      if (f.name.endsWith("/") || !WANTED[name]) return false;
      files += 1;
      total += f.originalSize;
      if (files > ZIP_LIMITS.files || f.originalSize > ZIP_LIMITS.fileBytes || total > ZIP_LIMITS.totalBytes) {
        throw new ZipTooLargeError();
      }
      return true;
    },
  });
}

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
      const entries = unzipSessionFiles(bytes);
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
