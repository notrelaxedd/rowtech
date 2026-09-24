// The node's session format, exactly as LoadCellNode writes it
// (LoadCellNode_v10/storage.cpp, identical in v9). Nothing here is guessed:
// change it only when the firmware changes, and bump SESSION_FORMAT with it.
//
//   /sessions/S0042/meta.json     identity, calibration, totals
//   /sessions/S0042/strokes.csv   one line per stroke, with a header row
//   /sessions/S0042/curves.bin    fixed 128-byte records: 64 x int16, LE
//   /sessions/S0042/events.csv    tare, calibration, overload, battery, marks

/** The only session format this parser accepts (meta.json "format"). */
export const SESSION_FORMAT = 1;

/** storage.cpp STROKE_HEADER, minus the newline. Checked exactly. */
export const STROKE_HEADER =
  "rec,seq,catch_ms,drive_ms,recovery_ms,peak,peak_pos_pct,impulse,rise_rate,third1,third2,third3,curve_valid";
export const EVENT_HEADER = "t_ms,type,detail";

/** board.h CURVE_POINTS, and the record stride in curves.bin. */
export const CURVE_POINTS = 64;
export const CURVE_BYTES = CURVE_POINTS * 2;

/** Every curve sample is this fraction of the stroke's own peak. */
export const CURVE_SCALE = 10000;

export const FILE_NAMES = ["meta.json", "strokes.csv", "curves.bin", "events.csv"] as const;
export type FileName = (typeof FILE_NAMES)[number];

export type Calibration = {
  valid: boolean;
  points: number;
  slope: number;
  intercept: number;
  /** The node's own worst-case error, in percent. */
  linErrPct: number;
  tareOffset: number;
};

export type SessionMeta = {
  format: number;
  uuid: string;
  deviceId: string;
  /**
   * Seat the node was on, 1 to 8; null when it was never set. The node writes
   * 0 for that, and 0 is the cox's seat, where a node never sits.
   */
  seat: number | null;
  firmware: string;
  git: string;
  /** The node's own session counter. */
  session: number;
  openReason: string;
  startMs: number;
  endMs: number | null;
  elapsedMs: number | null;
  closeReason: string | null;
  /** False when the boat was switched off mid-session. */
  closed: boolean;
  units: string;
  curvePoints: number;
  curveScale: number;
  sampleRate: number;
  /** "boot_ms": the node has no clock, so times are ms since it booted. */
  clock: string;
  strokes: number;
  droppedSamples: number;
  cal: Calibration;
};

/** One line of strokes.csv. Units follow meta.units: kg when calibrated, else raw counts. */
export type StrokeRow = {
  /** Record number. Its curve is at rec * 128 in curves.bin. */
  rec: number;
  /** The detector's own stroke sequence, which survives across sessions. */
  seq: number;
  catchMs: number;
  driveMs: number;
  recoveryMs: number;
  peak: number;
  peakPosPct: number;
  impulse: number;
  riseRate: number;
  thirds: [number, number, number];
  curveValid: boolean;
};

export type SessionEvent = { tMs: number; type: string; detail: string };

export type ParsedSession = {
  meta: SessionMeta;
  strokes: StrokeRow[];
  events: SessionEvent[];
  /** curves.bin as it came off the card. Sliced per stroke, never re-encoded. */
  curves: Uint8Array | null;
};

export class SessionFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionFormatError";
  }
}
