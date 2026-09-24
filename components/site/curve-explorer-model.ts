// The stroke chart's data: every number is computed from the curve it draws,
// the way the node computes it. Pure, so the server-rendered static view and
// the interactive client share it.
import { EXAMPLE, impulseCv, measureStroke, recentStrokes, strokeForce, toPath } from "@/lib/stroke";
import { NODE } from "@/lib/stroke-detector";
import type { Input, LiveState, LiveSummary, MetricId } from "./stroke-live-types";
import { PX0, PX1, y } from "./stroke-frame";

export const STROKES = recentStrokes();
export const M = measureStroke();
export const CV = impulseCv(STROKES);

export const T0 = -0.1;
export const T1 = 1.15;
export const x = (t: number) => PX0 + ((t - T0) / (T1 - T0)) * (PX1 - PX0);

export function curve(v = STROKES[0], a = T0, b = T1) {
  const pts: Array<[number, number]> = [];
  for (let t = a; t <= b + 1e-9; t += 0.004) pts.push([x(t), y(strokeForce(t, v))]);
  return toPath(pts, 0.5);
}
export function area(a: number, b: number) {
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
    body: `The node marks the catch where force crosses 15% of the rower's recent peak (${f1(M.threshold)} kg here) and interpolates between samples. Samples arrive every 12.5 ms; the catch lands to within about 3 ms. That precision is what makes crew timing possible.`,
  },
  {
    id: "rise",
    label: "Rise rate",
    value: `${M.rise.toFixed(0)} kg/s`,
    body: "How quickly the blade loads in the first 100 ms after the catch. A soft rise is a missed catch you can see, and put a number on.",
  },
  {
    id: "peak",
    label: "Peak & position",
    value: `${f1(M.peakKg)} kg at ${M.peakPct.toFixed(0)}%`,
    body: `The peak, and where it falls in the drive: ${M.peakPct.toFixed(0)}% of the way through here. The shape of the curve says as much about technique as its height.`,
  },
  {
    id: "thirds",
    label: "Work by thirds",
    value: `${M.thirds.map((v) => Math.round((v / M.impulse) * 100)).join(" / ")} %`,
    body: `Impulse (force × time, ${f1(M.impulse)} kg·s for this stroke) split across the front, middle and finish of the drive, in kg·s on the chart. It shows where the work actually happens.`,
  },
  {
    id: "release",
    label: "Release",
    value: "½ threshold",
    body: "Release is called at half the catch threshold. That gap means a wobble at the finish can't split one stroke into two.",
  },
  {
    id: "rhythm",
    label: "Rhythm",
    value: `1 : ${(M.recoveryMs / M.driveMs).toFixed(2)}`,
    body: `Drive ${M.driveMs.toFixed(0)} ms, recovery ${M.recoveryMs.toFixed(0)} ms, at ${EXAMPLE.spm} strokes a minute. Timing like this needs no calibration at all.`,
  },
  {
    id: "consistency",
    label: "Consistency",
    value: `CV ${f1(CV)}%`,
    body: "How much impulse varies over the last eight strokes, shown faintly behind this one. Lower is more repeatable.",
  },
];

/** The same seven measures, read off the visitor's own strokes. */
export function liveMetric(id: MetricId, L: LiveSummary): { value: string; body: string } {
  const s = L.strokes[0];
  const done = L.strokes.find((k) => k.recoveryMs !== null);
  const n = L.strokes.length;
  switch (id) {
    case "catch":
      return s
        ? {
            value: `+${f1(s.catchLagMs)} ms`,
            body: `Your catch crossed ${f1(s.threshold)} kg ${f1(s.catchLagMs)} ms after the sample before it. Samples arrive every 12.5 ms; the node interpolates between two of them to place the catch, and that is what makes crew timing possible.`,
          }
        : {
            value: "—",
            body: `The dashed line is where a catch is called. Until your first stroke it sits at five times the sensor's noise (${f1(L.threshold)} kg), so an idle node can't trigger itself. After that it's 15% of your recent peak.`,
          };
    case "rise":
      return {
        value: s ? `${s.rise.toFixed(0)} kg/s` : "—",
        body: "How fast force built in the first 100 ms after your catch. Start low and snap upward for a sharp catch, or ease in and watch the number fall.",
      };
    case "peak":
      return s
        ? {
            value: `${f1(s.peakKg)} kg at ${s.peakPct.toFixed(0)}%`,
            body: `Your peak, and where it fell: ${s.peakPct.toFixed(0)}% of the way through your drive. The shape of the curve says as much as its height.`,
          }
        : { value: "—", body: "The highest force in the drive, and how far through the drive it landed." };
    case "thirds":
      return s
        ? {
            value: `${s.thirds.map((v) => Math.round((v / s.impulse) * 100)).join(" / ")} %`,
            body: `Impulse (force × time, ${f1(s.impulse)} kg·s for this stroke) split across the front, middle and finish of your drive, in kg·s on the chart.`,
          }
        : { value: "—", body: "Impulse split across the front, middle and finish of the drive: where the work actually happens." };
    case "release":
      return {
        value: s ? `${f1(s.threshold / 2)} kg` : "½ threshold",
        body: `Release is called when force falls through half the catch threshold. Tap and let go quickly: anything under ${NODE.minDriveMs} ms of drive is thrown away, because a knock on the rigger isn't a stroke.`,
      };
    case "rhythm":
      return done && done.recoveryMs !== null
        ? {
            value: `1 : ${(done.recoveryMs / done.driveMs).toFixed(2)}`,
            body: `Drive ${done.driveMs.toFixed(0)} ms, recovery ${done.recoveryMs.toFixed(0)} ms${L.spm ? `, at ${f1(L.spm)} strokes a minute` : ""}. Recovery only exists once the next catch lands.`,
          }
        : { value: "—", body: "Take a second stroke. Recovery, and so rhythm, only exists once the next catch lands." };
    case "consistency":
      return {
        value: L.cv !== null ? `CV ${f1(L.cv)}%` : `${n}/3 strokes`,
        body:
          L.cv !== null
            ? `How much impulse varies over your last ${Math.min(n, NODE.cvWindow)} strokes, drawn faintly behind the current one. Lower is more repeatable. Try to make them match.`
            : "How much impulse varies from stroke to stroke. The node wants three strokes before it will say.",
      };
  }
}

export const STATE: Record<LiveState, { text: string; lamp: string; tone: string }> = {
  ready: { text: "Ready", lamp: "bg-white/45", tone: "text-foreground" },
  drive: { text: "Drive", lamp: "bg-trace", tone: "text-trace" },
  recovery: { text: "Recovery", lamp: "bg-ok", tone: "text-ok" },
  idle: { text: "Idle", lamp: "bg-white/25", tone: "text-muted-foreground" },
  short: { text: "Too short", lamp: "bg-warn", tone: "text-warn" },
};

export const IDLE_INPUT: Input = { src: "none", kg: 0, since: 0 };

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
