// The stroke chart's data: every number is computed from the curve it draws,
// the way the node computes it. Pure, so the server-rendered static view and
// the interactive client share it.
import { EXAMPLE, impulseCv, measureStroke, recentStrokes, strokeForce, toPath } from "@/lib/stroke";
import { PX0, PX1, y } from "./stroke-frame";

export type MetricId = "catch" | "rise" | "peak" | "thirds" | "release" | "rhythm" | "consistency";

export const STROKES = recentStrokes();
export const M = measureStroke();
const CV = impulseCv(STROKES);

const T0 = -0.1;
const T1 = 1.15;
export const x = (t: number) => PX0 + ((t - T0) / (T1 - T0)) * (PX1 - PX0);

export function curve(v = STROKES[0], a = T0, b = T1) {
  const pts: Array<[number, number]> = [];
  for (let t = a; t <= b + 1e-9; t += 0.004) pts.push([x(t), y(strokeForce(t, v))]);
  return toPath(pts, 0.5);
}
function area(a: number, b: number) {
  return `${curve(STROKES[0], a, b)}L${x(b).toFixed(1)} ${y(0).toFixed(1)}L${x(a).toFixed(1)} ${y(0).toFixed(1)}Z`;
}

export const MAIN = curve();
export const GHOSTS = STROKES.slice(1).map((s) => curve(s));
export const third = (M.releaseT - M.catchT) / 3;
export const THIRD_AREAS = [0, 1, 2].map((i) => area(M.catchT + i * third, M.catchT + (i + 1) * third));
export const NEAR_CATCH = M.samples.filter(([t]) => Math.abs(t - M.catchT) < 0.045);
export const RISE_END = M.catchT + 0.1;

export const f1 = (n: number) => n.toFixed(1);
export const METRICS: ReadonlyArray<{ id: MetricId; label: string; value: string; body: string }> = [
  {
    id: "catch",
    label: "Catch",
    value: "≈3 ms",
    body: `The node marks the catch where force crosses 15% of the rower’s recent peak (${f1(M.threshold)} kg here) and interpolates between samples. Samples arrive every 12.5 ms; the catch lands to within about 3 ms. That precision is what makes crew timing possible.`,
  },
  {
    id: "rise",
    label: "Rise rate",
    value: `${M.rise.toFixed(0)} kg/s`,
    body: "How quickly the blade loads in the first 100 ms after the catch. A soft rise is a missed catch you can see, and put a number on.",
  },
  {
    id: "peak",
    label: "Peak and position",
    value: `${f1(M.peakKg)} kg at ${M.peakPct.toFixed(0)}%`,
    body: `The peak, and where it falls in the drive: ${M.peakPct.toFixed(0)}% of the way through here. The shape of the curve says as much about technique as its height.`,
  },
  {
    id: "thirds",
    label: "Work by thirds",
    value: M.thirds.map((v) => `${Math.round((v / M.impulse) * 100)}%`).join(" / "),
    body: `Impulse (force × time, ${f1(M.impulse)} kg·s for this stroke) split across the front, middle and finish of the drive, in kg·s on the chart. It shows where the work actually happens.`,
  },
  {
    id: "release",
    label: "Release",
    value: `${f1(M.threshold / 2)} kg`,
    body: `Release is called at half the catch threshold (${f1(M.threshold / 2)} kg here). That gap means a wobble at the finish can’t split one stroke into two.`,
  },
  {
    id: "rhythm",
    label: "Rhythm",
    value: `1:${(M.recoveryMs / M.driveMs).toFixed(2)}`,
    body: `Drive ${M.driveMs.toFixed(0)} ms, recovery ${M.recoveryMs.toFixed(0)} ms, at ${EXAMPLE.spm} strokes a minute. Timing like this needs no calibration at all.`,
  },
  {
    id: "consistency",
    label: "Consistency",
    value: `CV ${f1(CV)}%`,
    body: "How much impulse varies over the last eight strokes, shown faintly behind this one. Lower is more repeatable.",
  },
];

// -----------------------------------------------------------------------------
// Phases of the example stroke, for the strip under the chart and the cursor
// that runs along the curve.
// -----------------------------------------------------------------------------
export const PHASES = ["catch", "drive", "peak", "release", "recovery"] as const;
export type Phase = (typeof PHASES)[number];

export function phaseAt(t: number): Phase {
  if (Math.abs(t - M.catchT) < 0.03) return "catch";
  if (Math.abs(t - M.peakT) < 0.04) return "peak";
  if (Math.abs(t - M.releaseT) < 0.03) return "release";
  if (t > M.catchT && t < M.releaseT) return "drive";
  return "recovery";
}

/** Where on the stroke each measure lives: picking one sends the cursor there. */
export function metricT(id: MetricId): number {
  switch (id) {
    case "catch":
      return M.catchT;
    case "rise":
      return M.catchT + 0.05;
    case "peak":
    case "consistency":
      return M.peakT;
    case "thirds":
      return (M.catchT + M.releaseT) / 2;
    case "release":
      return M.releaseT;
    case "rhythm":
      return Math.min(T1 - 0.02, M.releaseT + 0.18);
  }
}

/** Time on the chart under a viewBox x, clamped to the chart. */
export const tAtX = (vx: number) => Math.min(T1, Math.max(T0, T0 + ((vx - PX0) / (PX1 - PX0)) * (T1 - T0)));
