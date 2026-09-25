// What a coach reads off a session. Everything here is derived from the rows
// the node wrote -- no smoothing, no invented numbers.
import type { StrokeRow } from "./format";

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function cv(xs: number[]): number | null {
  if (xs.length < 3) return null;
  const m = mean(xs);
  if (!m) return null;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
  return (sd / m) * 100;
}

export type SessionSummary = {
  strokes: number;
  /** First catch to the last release, ms. */
  durationMs: number;
  avgRate: number | null;
  avgPeak: number;
  avgImpulse: number;
  avgDriveMs: number;
  avgRecoveryMs: number;
  avgPeakPosPct: number;
  avgRiseRate: number;
  /** Impulse CV over the session, in percent: lower is more repeatable. */
  consistencyPct: number | null;
};

/** Stroke rate between this stroke's catch and the one before it. */
export function rateAt(strokes: StrokeRow[], i: number): number | null {
  if (i <= 0 || i >= strokes.length) return null;
  const dt = strokes[i].catchMs - strokes[i - 1].catchMs;
  return dt > 0 ? 60000 / dt : null;
}

export function summarise(strokes: StrokeRow[]): SessionSummary {
  if (!strokes.length) {
    return {
      strokes: 0, durationMs: 0, avgRate: null, avgPeak: 0, avgImpulse: 0,
      avgDriveMs: 0, avgRecoveryMs: 0, avgPeakPosPct: 0, avgRiseRate: 0, consistencyPct: null,
    };
  }
  const last = strokes[strokes.length - 1];
  const rates = strokes.map((_, i) => rateAt(strokes, i)).filter((r): r is number => r !== null);
  return {
    strokes: strokes.length,
    durationMs: last.catchMs + last.driveMs - strokes[0].catchMs,
    avgRate: rates.length ? mean(rates) : null,
    avgPeak: mean(strokes.map((s) => s.peak)),
    avgImpulse: mean(strokes.map((s) => s.impulse)),
    avgDriveMs: mean(strokes.map((s) => s.driveMs)),
    avgRecoveryMs: mean(strokes.map((s) => s.recoveryMs)),
    avgPeakPosPct: mean(strokes.map((s) => s.peakPosPct)),
    avgRiseRate: mean(strokes.map((s) => s.riseRate)),
    consistencyPct: cv(strokes.map((s) => s.impulse)),
  };
}

/** Work split across the drive, as percentages that add up to 100. */
export function thirdsPct(s: StrokeRow): [number, number, number] {
  const total = s.thirds[0] + s.thirds[1] + s.thirds[2];
  if (!total) return [0, 0, 0];
  return [(s.thirds[0] / total) * 100, (s.thirds[1] / total) * 100, (s.thirds[2] / total) * 100];
}

export const METRICS = [
  { id: "peak", label: "Peak", unit: "", get: (s: StrokeRow) => s.peak },
  { id: "impulse", label: "Impulse", unit: "·s", get: (s: StrokeRow) => s.impulse },
  { id: "riseRate", label: "Rise rate", unit: "/s", get: (s: StrokeRow) => s.riseRate },
  { id: "peakPos", label: "Peak position", unit: "%", get: (s: StrokeRow) => s.peakPosPct },
  { id: "driveMs", label: "Drive", unit: " ms", get: (s: StrokeRow) => s.driveMs },
  { id: "recoveryMs", label: "Recovery", unit: " ms", get: (s: StrokeRow) => s.recoveryMs },
  { id: "ratio", label: "Drive:recovery", unit: "", get: (s: StrokeRow) => (s.driveMs ? s.recoveryMs / s.driveMs : 0) },
] as const;

export type MetricId = (typeof METRICS)[number]["id"];

export function metric(id: MetricId) {
  return METRICS.find((m) => m.id === id) ?? METRICS[0];
}

/** Formats a value the way the node would: only the precision it can resolve. */
export function fmt(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

export function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** strokes.csv back out again, byte-for-byte in the firmware's own shape. */
export function toCsv(strokes: StrokeRow[]): string {
  const header = "rec,seq,catch_ms,drive_ms,recovery_ms,peak,peak_pos_pct,impulse,rise_rate,third1,third2,third3,curve_valid";
  const rows = strokes.map((s) =>
    [
      s.rec, s.seq, s.catchMs, s.driveMs, s.recoveryMs,
      s.peak.toFixed(4), s.peakPosPct, s.impulse.toFixed(5), s.riseRate.toFixed(4),
      s.thirds[0].toFixed(5), s.thirds[1].toFixed(5), s.thirds[2].toFixed(5),
      s.curveValid ? 1 : 0,
    ].join(",")
  );
  return `${header}\n${rows.join("\n")}\n`;
}
