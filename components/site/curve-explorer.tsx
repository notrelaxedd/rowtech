"use client";

import { useState } from "react";
import { EXAMPLE, impulseCv, measureStroke, recentStrokes, strokeForce, toPath } from "@/lib/stroke";
import { cn } from "@/lib/utils";
import { InView } from "./in-view";

// Everything on this chart is computed from the curve it draws, the way the
// node computes it (lib/stroke.ts measureStroke): no number is typed in.
const STROKES = recentStrokes();
const M = measureStroke();
const CV = impulseCv(STROKES);

const W = 640;
const H = 300;
const PX0 = 44;
const PX1 = 624;
const T0 = -0.1;
const T1 = 1.15;
const KG0 = -4;
const KG1 = 70;
const PY0 = 262;
const PY1 = 18;
const x = (t: number) => PX0 + ((t - T0) / (T1 - T0)) * (PX1 - PX0);
const y = (kg: number) => PY0 + ((kg - KG0) / (KG1 - KG0)) * (PY1 - PY0);

function curve(v = STROKES[0], a = T0, b = T1) {
  const pts: Array<[number, number]> = [];
  for (let t = a; t <= b + 1e-9; t += 0.004) pts.push([x(t), y(strokeForce(t, v))]);
  return toPath(pts);
}
function area(a: number, b: number) {
  return `${curve(STROKES[0], a, b)}L${x(b).toFixed(1)} ${y(0).toFixed(1)}L${x(a).toFixed(1)} ${y(0).toFixed(1)}Z`;
}

const MAIN = curve();
const GHOSTS = STROKES.slice(1).map((s) => curve(s));
const third = (M.releaseT - M.catchT) / 3;
const THIRD_AREAS = [0, 1, 2].map((i) => area(M.catchT + i * third, M.catchT + (i + 1) * third));
const NEAR_CATCH = M.samples.filter(([t]) => Math.abs(t - M.catchT) < 0.045);
const RISE_END = M.catchT + 0.1;

const f1 = (n: number) => n.toFixed(1);
const METRICS = [
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
    value: `${f1(M.peakKg)} kg · ${M.peakPct.toFixed(0)}%`,
    body: `The peak, and where it falls in the drive: ${M.peakPct.toFixed(0)}% of the way through here. The shape of the curve says as much about technique as its height.`,
  },
  {
    id: "thirds",
    label: "Work by thirds",
    value: `${M.thirds.map((v) => Math.round((v / M.impulse) * 100)).join(" · ")} %`,
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
] as const;

type Id = (typeof METRICS)[number]["id"];

export function CurveExplorer() {
  const [active, setActive] = useState<Id>("catch");
  const on = (id: Id) => (active === id ? 1 : 0);
  const current = METRICS.find((m) => m.id === active)!;
  const fade = "transition-opacity duration-300 ease-out motion-reduce:transition-none";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18.5rem_minmax(0,1fr)] lg:gap-10">
      <div
        role="group"
        aria-label="Stroke metrics"
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {METRICS.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={active === m.id}
            onClick={() => setActive(m.id)}
            className={cn(
              "group flex min-h-11 shrink-0 items-baseline justify-between gap-6 rounded-md border px-3.5 py-2.5 text-left transition-colors lg:rounded-none lg:border-x-0 lg:border-t-0 lg:border-b lg:px-1 lg:py-3.5",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace",
              active === m.id
                ? "border-trace/50 bg-trace/[0.07] lg:border-line lg:bg-transparent"
                : "border-line hover:border-white/25 lg:hover:border-line"
            )}
          >
            <span
              className={cn(
                "text-[0.9375rem] font-semibold whitespace-nowrap transition-colors",
                active === m.id ? "text-trace" : "text-foreground group-hover:text-trace"
              )}
            >
              {m.label}
            </span>
            <span className="readout hidden text-sm whitespace-nowrap text-muted-foreground sm:inline">{m.value}</span>
          </button>
        ))}
      </div>

      <div className="min-w-0">
        <InView className="overflow-hidden rounded-lg border border-line bg-panel">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Force curve of one stroke. ${current.label}: ${current.value}.`} className="block h-auto w-full">
            {[0, 20, 40, 60].map((kg) => (
              <g key={kg}>
                <line x1={PX0} x2={PX1} y1={y(kg)} y2={y(kg)} stroke={kg === 0 ? "rgb(255 255 255 / 0.22)" : "rgb(255 255 255 / 0.06)"} />
                <text x={PX0 - 8} y={y(kg) + 4} textAnchor="end" className="fill-muted-foreground font-mono text-[10px] max-sm:text-[17px]">
                  {kg}
                </text>
              </g>
            ))}
            <text x={PX0 - 8} y={PY1 - 4} textAnchor="end" className="fill-muted-foreground font-mono text-[10px] max-sm:text-[17px]">
              kg
            </text>
            {[0, 0.25, 0.5, 0.75, 1].map((s) => (
              <text key={s} x={x(M.catchT + s)} y={H - 16} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px] max-sm:text-[17px]">
                {s === 0 ? "catch" : `+${s * 1000} ms`}
              </text>
            ))}

            {/* consistency: the last eight strokes */}
            <g className={fade} style={{ opacity: 0.25 + 0.75 * on("consistency") }}>
              {GHOSTS.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  pathLength={1}
                  fill="none"
                  stroke={on("consistency") ? "var(--trace)" : "white"}
                  strokeOpacity={on("consistency") ? 0.4 : 0.14}
                  strokeWidth={1.25}
                  className="draw"
                  style={{ "--i": i + 3 } as React.CSSProperties}
                />
              ))}
            </g>

            {/* work by thirds */}
            <g className={fade} style={{ opacity: on("thirds") }}>
              {THIRD_AREAS.map((d, i) => (
                <path key={i} d={d} fill="var(--trace)" fillOpacity={i === 1 ? 0.26 : 0.13} />
              ))}
              {M.thirds.map((v, i) => (
                <text key={i} x={x(M.catchT + (i + 0.5) * third)} y={y(4)} textAnchor="middle" className="fill-foreground font-mono text-[11px] max-sm:text-[18px]">
                  {f1(v)}
                </text>
              ))}
            </g>

            <path d={MAIN} pathLength={1} fill="none" stroke="var(--trace)" strokeWidth={2.25} strokeLinejoin="round" className="draw" />

            {/* catch: threshold, raw samples, interpolated crossing */}
            <g className={fade} style={{ opacity: on("catch") }}>
              <line x1={PX0} x2={PX1} y1={y(M.threshold)} y2={y(M.threshold)} stroke="var(--warn)" strokeOpacity={0.7} strokeDasharray="4 4" />
              <text x={PX1} y={y(M.threshold) - 6} textAnchor="end" className="fill-warn font-mono text-[10px] max-sm:text-[17px]">
                catch threshold
              </text>
              {NEAR_CATCH.map(([t, kg]) => (
                <circle key={t} cx={x(t)} cy={y(kg)} r={3} fill="var(--background)" stroke="white" strokeWidth={1.25} />
              ))}
              <line x1={x(M.catchT)} x2={x(M.catchT)} y1={y(M.threshold) - 22} y2={y(0) + 6} stroke="var(--warn)" strokeWidth={1.5} />
            </g>

            {/* rise rate over the first 100 ms */}
            <g className={fade} style={{ opacity: on("rise") }}>
              <path d={curve(STROKES[0], M.catchT, RISE_END)} fill="none" stroke="var(--warn)" strokeWidth={4} strokeLinecap="round" />
              <line x1={x(M.catchT)} x2={x(RISE_END)} y1={y(M.threshold)} y2={y(strokeForce(RISE_END))} stroke="white" strokeOpacity={0.6} strokeDasharray="3 3" />
              <text x={x(RISE_END) + 8} y={y(strokeForce(RISE_END)) + 4} className="fill-foreground font-mono text-[11px] max-sm:text-[18px]">
                100 ms
              </text>
            </g>

            {/* peak and its position */}
            <g className={fade} style={{ opacity: on("peak") }}>
              <line x1={x(M.peakT)} x2={x(M.peakT)} y1={y(M.peakKg)} y2={y(0)} stroke="white" strokeOpacity={0.35} strokeDasharray="3 3" />
              <circle cx={x(M.peakT)} cy={y(M.peakKg)} r={5} fill="var(--warn)" />
              <text x={x(M.peakT) + 10} y={y(M.peakKg) + 4} className="fill-foreground font-mono text-[11px] max-sm:text-[18px]">
                {f1(M.peakKg)} kg at {M.peakPct.toFixed(0)}%
              </text>
            </g>

            {/* release at half threshold */}
            <g className={fade} style={{ opacity: on("release") }}>
              <line x1={PX0} x2={PX1} y1={y(M.threshold / 2)} y2={y(M.threshold / 2)} stroke="var(--warn)" strokeOpacity={0.7} strokeDasharray="4 4" />
              <line x1={x(M.releaseT)} x2={x(M.releaseT)} y1={y(M.threshold / 2) - 24} y2={y(0) + 6} stroke="var(--warn)" strokeWidth={1.5} />
              <text x={x(M.releaseT) + 8} y={y(M.threshold / 2) - 10} className="fill-warn font-mono text-[10px] max-sm:text-[17px]">
                release
              </text>
            </g>
          </svg>

          {/* drive : recovery, to scale */}
          <div className={cn("border-t border-line px-4 py-3", fade)} style={{ opacity: 0.45 + 0.55 * on("rhythm") }}>
            <div className="flex h-2 overflow-hidden rounded-full" aria-hidden>
              <div className="bg-trace" style={{ flexGrow: M.driveMs }} />
              <div className="bg-white/15" style={{ flexGrow: M.recoveryMs }} />
            </div>
            <div className="readout mt-2 flex justify-between text-xs text-muted-foreground">
              <span>drive {M.driveMs.toFixed(0)} ms</span>
              <span>recovery {M.recoveryMs.toFixed(0)} ms</span>
            </div>
          </div>
        </InView>

        <div aria-live="polite" className="mt-5 min-h-[7.5rem]">
          <p className="type-h3">
            {current.label} <span className="readout ml-2 text-base font-normal text-trace">{current.value}</span>
          </p>
          <p className="type-body mt-2 max-w-[62ch] text-muted-foreground">{current.body}</p>
        </div>
      </div>
    </div>
  );
}
