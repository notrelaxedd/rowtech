// Parsers for a node session. Strict: a file that isn't what storage.cpp
// writes is rejected with a message that says which line and why, rather than
// being half-read into wrong numbers.
import {
  CURVE_BYTES,
  CURVE_POINTS,
  CURVE_SCALE,
  EVENT_HEADER,
  SESSION_FORMAT,
  STROKE_HEADER,
  SessionFormatError,
  type Calibration,
  type ParsedSession,
  type SessionEvent,
  type SessionMeta,
  type StrokeRow,
} from "./format";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function isObject(v: Json | undefined): v is { [key: string]: Json } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: Json | undefined, where: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new SessionFormatError(`${where} should be a number.`);
  return v;
}
function str(v: Json | undefined, where: string): string {
  if (typeof v !== "string") throw new SessionFormatError(`${where} should be a string.`);
  return v;
}
function optNum(v: Json | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// What the dashboard's tables can hold (supabase/migrations/*_session_model.sql).
// Checked here so a file outside them is refused with a reason, before anything
// is written, rather than failing part-way through saving.
const INT4 = 2 ** 31 - 1;
const FLOAT4 = 3.4e38;

function short(v: string, max: number, where: string): string {
  if (v.length > max) throw new SessionFormatError(`${where} is longer than ${max} characters.`);
  return v;
}

function parseCal(v: Json | undefined): Calibration {
  if (!isObject(v)) throw new SessionFormatError("meta.json has no calibration block.");
  return {
    valid: v.valid === true,
    points: num(v.points, "meta.json cal.points"),
    slope: num(v.slope, "meta.json cal.slope"),
    intercept: num(v.intercept, "meta.json cal.intercept"),
    linErrPct: num(v.lin_err_pct, "meta.json cal.lin_err_pct"),
    tareOffset: num(v.tare_offset, "meta.json cal.tare_offset"),
  };
}

/** meta.json is under 1 kB as the node writes it; it is kept whole, so it's capped. */
const META_MAX_CHARS = 64 * 1024;

export function parseMeta(text: string): SessionMeta {
  if (text.length > META_MAX_CHARS) throw new SessionFormatError("meta.json is far bigger than a node writes (over 64 kB).");
  let raw: Json;
  try {
    raw = JSON.parse(text) as Json;
  } catch {
    throw new SessionFormatError("meta.json isn't valid JSON.");
  }
  if (!isObject(raw)) throw new SessionFormatError("meta.json should be a JSON object.");

  const format = num(raw.format, "meta.json format");
  if (format !== SESSION_FORMAT) {
    throw new SessionFormatError(
      `This session is format ${format}; this dashboard reads format ${SESSION_FORMAT}. Update the dashboard before uploading it.`
    );
  }
  const curvePoints = num(raw.curve_points, "meta.json curve_points");
  if (curvePoints !== CURVE_POINTS) {
    throw new SessionFormatError(`This session has ${curvePoints}-point curves; this dashboard reads ${CURVE_POINTS}.`);
  }

  const seat = num(raw.seat, "meta.json seat");
  if (!Number.isInteger(seat) || seat < 0 || seat > 8) throw new SessionFormatError("meta.json seat should be a whole number from 0 to 8.");
  const curveScale = num(raw.curve_scale, "meta.json curve_scale");
  if (!Number.isInteger(curveScale) || Math.abs(curveScale) > INT4) throw new SessionFormatError("meta.json curve_scale is out of range.");
  const sampleRate = num(raw.sample_rate, "meta.json sample_rate");
  if (Math.abs(sampleRate) > FLOAT4) throw new SessionFormatError("meta.json sample_rate is out of range.");
  const elapsedMs = optNum(raw.elapsed_ms);
  if (elapsedMs !== null && (!Number.isInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > INT4)) {
    throw new SessionFormatError("meta.json elapsed_ms is out of range.");
  }

  return {
    format,
    uuid: short(str(raw.uuid, "meta.json uuid"), 64, "meta.json uuid"),
    deviceId: short(str(raw.device_id, "meta.json device_id"), 64, "meta.json device_id"),
    seat: seat === 0 ? null : seat,
    firmware: str(raw.fw, "meta.json fw"),
    git: typeof raw.git === "string" ? raw.git : "",
    session: num(raw.session, "meta.json session"),
    openReason: typeof raw.open_reason === "string" ? raw.open_reason : "",
    startMs: num(raw.start_ms, "meta.json start_ms"),
    endMs: optNum(raw.end_ms),
    elapsedMs,
    closeReason: typeof raw.close_reason === "string" ? raw.close_reason : null,
    closed: raw.closed === true,
    units: short(str(raw.units, "meta.json units"), 12, "meta.json units"),
    curvePoints,
    curveScale,
    sampleRate,
    clock: typeof raw.clock === "string" ? raw.clock : "boot_ms",
    strokes: num(raw.strokes, "meta.json strokes"),
    droppedSamples: optNum(raw.dropped_samples) ?? 0,
    cal: parseCal(raw.cal),
  };
}

/** Splits on either line ending and drops a trailing blank line. */
function lines(text: string): string[] {
  const out = text.replace(/\r\n/g, "\n").split("\n");
  while (out.length && out[out.length - 1].trim() === "") out.pop();
  return out;
}

function field(parts: string[], i: number, line: number, name: string): number {
  const v = Number(parts[i]);
  if (parts[i] === undefined || parts[i] === "" || !Number.isFinite(v)) {
    throw new SessionFormatError(`strokes.csv line ${line}: ${name} isn't a number.`);
  }
  if (Math.abs(v) > FLOAT4) throw new SessionFormatError(`strokes.csv line ${line}: ${name} is out of range.`);
  return v;
}

/** A count or a time in ms: a whole number from 0 to max. */
function whole(parts: string[], i: number, line: number, name: string, max: number): number {
  const v = field(parts, i, line, name);
  if (!Number.isInteger(v) || v < 0 || v > max) {
    throw new SessionFormatError(`strokes.csv line ${line}: ${name} should be a whole number from 0 to ${max}.`);
  }
  return v;
}

export function parseStrokes(text: string): StrokeRow[] {
  const rows = lines(text);
  if (!rows.length) throw new SessionFormatError("strokes.csv is empty.");
  if (rows[0].trim() !== STROKE_HEADER) {
    throw new SessionFormatError(
      `strokes.csv doesn't have the header this firmware writes.\nexpected: ${STROKE_HEADER}\nfound:    ${rows[0].trim()}`
    );
  }

  const strokes: StrokeRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const line = rows[i].trim();
    if (!line) continue;
    const p = line.split(",");
    if (p.length !== 13) {
      throw new SessionFormatError(`strokes.csv line ${i + 1}: expected 13 columns, found ${p.length}.`);
    }
    const n = i + 1;
    strokes.push({
      rec: whole(p, 0, n, "rec", INT4),
      seq: whole(p, 1, n, "seq", Number.MAX_SAFE_INTEGER),
      catchMs: whole(p, 2, n, "catch_ms", Number.MAX_SAFE_INTEGER),
      driveMs: whole(p, 3, n, "drive_ms", INT4),
      recoveryMs: whole(p, 4, n, "recovery_ms", INT4),
      peak: field(p, 5, n, "peak"),
      peakPosPct: whole(p, 6, n, "peak_pos_pct", 100),
      impulse: field(p, 7, n, "impulse"),
      riseRate: field(p, 8, n, "rise_rate"),
      thirds: [field(p, 9, n, "third1"), field(p, 10, n, "third2"), field(p, 11, n, "third3")],
      curveValid: field(p, 12, n, "curve_valid") === 1,
    });
  }
  return strokes;
}

export function parseEvents(text: string): SessionEvent[] {
  const rows = lines(text);
  if (!rows.length) return [];
  if (rows[0].trim() !== EVENT_HEADER) {
    throw new SessionFormatError(`events.csv doesn't have the header this firmware writes (${EVENT_HEADER}).`);
  }
  const events: SessionEvent[] = [];
  for (let i = 1; i < rows.length; i++) {
    const line = rows[i];
    if (!line.trim()) continue;
    // Only the first two commas separate fields; a detail may contain more.
    const a = line.indexOf(",");
    const b = line.indexOf(",", a + 1);
    if (a < 0 || b < 0) throw new SessionFormatError(`events.csv line ${i + 1}: expected three columns.`);
    const tMs = Number(line.slice(0, a));
    if (!Number.isFinite(tMs)) throw new SessionFormatError(`events.csv line ${i + 1}: t_ms isn't a number.`);
    events.push({ tMs, type: line.slice(a + 1, b), detail: line.slice(b + 1).trim() });
  }
  return events;
}

/** curves.bin must be a whole number of 128-byte records, one per stroke. */
export function checkCurves(bytes: Uint8Array, strokeCount: number): void {
  if (bytes.byteLength % CURVE_BYTES !== 0) {
    throw new SessionFormatError(
      `curves.bin is ${bytes.byteLength} bytes, which isn't a whole number of ${CURVE_BYTES}-byte records.`
    );
  }
  const records = bytes.byteLength / CURVE_BYTES;
  // Curve logging can be off, and a session can be cut short by a power-off;
  // more records than strokes means the files don't belong together.
  if (records > strokeCount) {
    throw new SessionFormatError(`curves.bin holds ${records} curves but strokes.csv has ${strokeCount} strokes.`);
  }
}

/**
 * The force curve for one stroke, as a fraction (0..1) of that stroke's peak,
 * evenly spaced from the catch to the release. Null when the node didn't
 * record one. Reads record `rec` at rec * 128, little-endian, as the ESP32
 * wrote it.
 */
export function curveAt(bytes: Uint8Array, rec: number, scale = CURVE_SCALE): Float32Array | null {
  const start = rec * CURVE_BYTES;
  if (rec < 0 || start + CURVE_BYTES > bytes.byteLength) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset + start, CURVE_BYTES);
  const out = new Float32Array(CURVE_POINTS);
  let anything = false;
  for (let i = 0; i < CURVE_POINTS; i++) {
    const v = view.getInt16(i * 2, true);
    if (v !== 0) anything = true;
    out[i] = v / scale;
  }
  // A stroke with no recoverable curve is written as 128 zero bytes.
  return anything ? out : null;
}

export type SessionInput = {
  meta: string;
  strokes: string;
  events?: string;
  curves?: Uint8Array;
};

/** Parse a whole session. Throws SessionFormatError with a readable reason. */
export function parseSession(input: SessionInput): ParsedSession {
  const meta = parseMeta(input.meta);
  const strokes = parseStrokes(input.strokes);
  const events = input.events ? parseEvents(input.events) : [];
  const curves = input.curves ?? null;
  if (curves) checkCurves(curves, strokes.length);
  return { meta, strokes, events, curves };
}
