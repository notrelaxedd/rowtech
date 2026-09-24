// Vieve, the RowTech cox box: crew sessions.
//
// ---------------------------------------------------------------------------
// TODO: write this parser when Vieve's session format is fixed.
//
// The hub is in development and its file format is not final, so there is
// nothing here to parse yet and nothing is guessed. What the schema is ready
// for, from what Vieve is specified to do:
//
//   * a crew session: one outing, stamped with GPS UTC
//     -> sessions.kind = 'crew', clock_source = 'gps'
//   * N seat sessions beneath it, all on the hub's clock, within 5 ms across
//     an eight -> sessions.parent_id, clock_source = 'gps',
//        sessions.clock_sync_ms = the hub's own worst case
//   * a 10 Hz GPS track: time, position, speed, heading
//     -> gps_points
//   * the seat data itself, which is the same stroke record the nodes write
//     -> strokes, through the parser in ./parse.ts
//
// Until then, an upload that looks like a Vieve bundle is refused with a
// message that says so, rather than being half-read into wrong numbers.
// ---------------------------------------------------------------------------
import type { NamedFile } from "./collect";

/** File names that would mean "this came off a Vieve, not a seat node". */
const VIEVE_HINTS = ["vieve.json", "crew.json", "gps.csv", "track.csv", "hub.json"];

export function looksLikeVieve(files: NamedFile[]): boolean {
  return files.some((f) => {
    const name = f.name.split(/[\\/]/).pop()?.toLowerCase() ?? "";
    return VIEVE_HINTS.includes(name);
  });
}

export class VieveNotSupportedError extends Error {
  constructor() {
    super(
      "That looks like a Vieve session. Vieve is still in development and its session format isn't final, so the dashboard can't read one yet. Seat node sessions work today."
    );
    this.name = "VieveNotSupportedError";
  }
}
