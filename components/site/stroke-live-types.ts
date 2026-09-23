// Types and initial state for the stroke chart's live mode. Kept out of the
// "use client" chart module so the server-rendered static view can use them
// without pulling the live engine into the page bundle.
import { NODE, type Sample, type Stroke } from "@/lib/stroke-detector";

/** `since` < 0 on a hold means "not started": the engine stamps it with its own clock. */
export type Input = { src: "none" | "pointer" | "hold"; kg: number; since: number };
export type LiveState = "ready" | "drive" | "recovery" | "idle" | "short";
/** What the chart spans: like the LIVE screen, a catch restarts it at the left edge. */
export type Win = { start: number; len: number; catchT: number | null };
export type LiveStroke = Stroke & { trace: Sample[] };
export type LiveSummary = {
  state: LiveState;
  strokes: LiveStroke[]; // newest first
  threshold: number;
  spm: number | null;
  cv: number | null;
  win: Win;
  note: string; // for the screen-reader live region
};

export type MetricId = "catch" | "rise" | "peak" | "thirds" | "release" | "rhythm" | "consistency";

export const NOISE = 0.35; // kg, one sigma
export const FIRST_WIN = 2400;

export const emptySummary = (): LiveSummary => ({
  state: "ready",
  strokes: [],
  threshold: NODE.noiseFloorMult * NOISE,
  spm: null,
  cv: null,
  win: { start: 0, len: FIRST_WIN, catchT: null },
  note: "",
});
