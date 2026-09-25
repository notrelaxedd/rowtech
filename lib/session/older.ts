const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:\d{2})?)$/;

/** The ?before= cursor from the URL: an instant, or null for the newest page. */
export const beforeParam = (v: unknown): string | null =>
  typeof v === "string" && INSTANT.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;

/**
 * One page of a newest-first list that was read with one row more than it
 * shows. Rows sharing the time of the first row left out go to the next page
 * as well, so none fall between pages. A crew and its seats usually share one
 * recorded_at, but not always (a seat uploaded again on its own takes the new
 * time), so a page doesn't rely on its crews' seats being on it. `older` is
 * the next page's cursor, read with .lt("recorded_at", older). Only a whole
 * page at one instant can't be split that way; it is shown and the rest of
 * that instant is skipped.
 */
export function newestFirstPage<T extends { recorded_at: string }>(rows: T[], size: number): { rows: T[]; older: string | null } {
  if (rows.length <= size) return { rows, older: null };
  const cut = rows[size].recorded_at;
  let end = size;
  while (end > 0 && rows[end - 1].recorded_at === cut) end--;
  if (end === 0) end = size;
  return { rows: rows.slice(0, end), older: rows[end - 1].recorded_at };
}
