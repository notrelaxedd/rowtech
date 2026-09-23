import type { HTMLAttributes, PointerEvent, ReactNode, Ref } from "react";
import { EXAMPLE, strokeForce } from "@/lib/stroke";
import { cn } from "@/lib/utils";
import { ctaSecondary } from "./cta";
import {
  GHOSTS,
  M,
  MAIN,
  METRICS,
  NEAR_CATCH,
  RISE_END,
  PHASES,
  STATE,
  STROKES,
  THIRD_AREAS,
  curve,
  f1,
  liveMetric,
  third,
  x,
} from "./curve-explorer-model";
import type { Phase } from "./curve-explorer-model";
import type { Input, LiveSummary, MetricId } from "./stroke-live-types";
import { H, KG_GRID, PX0, PX1, PY1, W, y } from "./stroke-frame";

// The stroke chart's markup, driven entirely by props. With no handlers it is
// the static, server-rendered version the page ships; the client island
// (curve-explorer.tsx) renders the same view with state and handlers wired in,
// so swapping one for the other changes nothing on screen.

export type CurveMode = "example" | "live";

export type CurveExplorerViewProps = {
  active: MetricId;
  mode: CurveMode;
  switched: boolean;
  live: LiveSummary;
  held: Input["src"];
  session: number;
  hintId?: string;
  liveChart?: ReactNode;
  chartRef?: Ref<HTMLDivElement>;
  readoutRef?: Ref<HTMLSpanElement>;
  /** The phase under the cursor (example) or the detector's state (live). */
  phase?: Phase | null;
  /** Drawn over the example curve: the cursor that runs along it. */
  cursor?: ReactNode;
  on?: {
    go?: (m: CurveMode) => void;
    setActive?: (id: MetricId) => void;
    down?: (e: PointerEvent<HTMLDivElement>) => void;
    move?: (e: PointerEvent<HTMLDivElement>) => void;
    up?: () => void;
    leave?: () => void;
    clear?: () => void;
    holdButton?: HTMLAttributes<HTMLButtonElement>;
  };
};

export function CurveExplorerView({
  active,
  mode,
  switched,
  live,
  held,
  session,
  hintId,
  liveChart,
  chartRef,
  readoutRef,
  phase = null,
  cursor,
  on,
}: CurveExplorerViewProps) {
  const isLive = mode === "live";
  const lit = (id: MetricId) => (active === id ? 1 : 0);
  const current = METRICS.find((m) => m.id === active)!;
  const shown = isLive ? liveMetric(active, live) : current;
  const fade = "transition-opacity duration-300 ease-out motion-reduce:transition-none";
  const st = STATE[live.state];
  const done = live.strokes.find((k) => k.recoveryMs !== null);
  const rhythm = isLive ? { drive: done?.driveMs ?? 0, recovery: done?.recoveryMs ?? 0 } : { drive: M.driveMs, recovery: M.recoveryMs };

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18.5rem_minmax(0,1fr)] lg:gap-10">
        <div className="min-w-0">
          <div role="group" aria-label="Which stroke to measure" className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-line bg-panel p-1">
            {(["example", "live"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={on?.go && (() => on.go!(m))}
                className={cn(
                  "flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold whitespace-nowrap transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace",
                  mode !== m && "text-muted-foreground hover:text-foreground",
                  mode === m && (m === "live" ? "bg-trace/[0.12] text-trace" : "bg-white/[0.08] text-foreground")
                )}
              >
                {m === "live" && <span aria-hidden className={cn("size-1.5 rounded-full bg-trace", !isLive && "rt-blink")} />}
                {m === "example" ? "Example stroke" : "Row it yourself"}
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="Stroke metrics"
            className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-0"
          >
            {METRICS.map((m) => {
              const value = isLive ? liveMetric(m.id, live).value : m.value;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={active === m.id}
                  onClick={on?.setActive && (() => on.setActive!(m.id))}
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
                  <span
                    key={isLive ? value : "example"}
                    className={cn("readout hidden text-sm whitespace-nowrap text-muted-foreground sm:inline", isLive && "rt-tick")}
                  >
                    {value}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0">
          <div data-reveal="" className="overflow-hidden rounded-lg border border-line bg-panel">
            {/* status strip, after the node's own LIVE header */}
            <div className="flex h-12 items-center justify-between gap-3 border-b border-line px-4">
              <p className="readout flex min-w-0 items-center gap-2 text-xs sm:text-sm">
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full transition-colors duration-150", isLive ? st.lamp : "bg-white/25")} />
                <span className={cn("shrink-0", isLive ? st.tone : "text-muted-foreground")}>{isLive ? st.text : "EXAMPLE"}</span>
                <span className="truncate text-muted-foreground">
                  {isLive
                    ? live.strokes.length
                      ? <>
                          {" · "}
                          <span className="max-sm:hidden">stroke </span>
                          <span className="sm:hidden">#</span>
                          {live.strokes[0].seq}
                          {live.spm ? ` · ${f1(live.spm)} spm` : ""}
                        </>
                      : " · waiting for a catch"
                    : ` · stroke ${EXAMPLE.strokes} · ${EXAMPLE.spm} spm`}
                </span>
              </p>
              <p className="readout flex shrink-0 items-baseline gap-1.5 text-xs text-muted-foreground">
                {!isLive && <span>peak</span>}
                <span key={mode} ref={readoutRef} className="min-w-[4ch] text-right text-xl text-foreground sm:text-2xl">
                  {isLive ? "0.0" : f1(EXAMPLE.peakKg)}
                </span>
                kg
              </p>
            </div>

            <div
              ref={chartRef}
              onPointerDown={on?.down}
              onPointerMove={on?.move}
              onPointerUp={on?.up}
              onPointerCancel={on?.up}
              onLostPointerCapture={on?.up}
              onPointerLeave={on?.leave}
              onClick={on?.go && (() => !isLive && on.go!("live"))}
              className={cn("group/chart relative select-none", isLive ? "cursor-ns-resize touch-none" : "cursor-pointer")}
            >
              {isLive ? (
                <div key={session} className={cn(switched && "rt-swap")}>
                  {liveChart}
                </div>
              ) : (
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  role="img"
                  aria-label={`Force curve of one stroke. ${current.label}: ${current.value}.`}
                  className={cn("block h-auto w-full", switched && "rt-swap")}
                >
                  {KG_GRID.map((kg) => (
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
                  <g className={fade} style={{ opacity: 0.25 + 0.75 * lit("consistency") }}>
                    {GHOSTS.map((d, i) => (
                      <path
                        key={i}
                        d={d}
                        pathLength={1}
                        fill="none"
                        stroke={lit("consistency") ? "var(--trace)" : "white"}
                        strokeOpacity={lit("consistency") ? 0.4 : 0.14}
                        strokeWidth={1.25}
                        className="draw"
                        style={{ "--i": i + 3 } as React.CSSProperties}
                      />
                    ))}
                  </g>

                  {/* work by thirds */}
                  <g className={fade} style={{ opacity: lit("thirds") }}>
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
                  <g className={fade} style={{ opacity: lit("catch") }}>
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
                  <g className={fade} style={{ opacity: lit("rise") }}>
                    <path d={curve(STROKES[0], M.catchT, RISE_END)} fill="none" stroke="var(--warn)" strokeWidth={4} strokeLinecap="round" />
                    <line x1={x(M.catchT)} x2={x(RISE_END)} y1={y(M.threshold)} y2={y(strokeForce(RISE_END))} stroke="white" strokeOpacity={0.6} strokeDasharray="3 3" />
                    <text x={x(RISE_END) + 8} y={y(strokeForce(RISE_END)) + 4} className="fill-foreground font-mono text-[11px] max-sm:text-[18px]">
                      100 ms
                    </text>
                  </g>

                  {/* peak and its position */}
                  <g className={fade} style={{ opacity: lit("peak") }}>
                    <line x1={x(M.peakT)} x2={x(M.peakT)} y1={y(M.peakKg)} y2={y(0)} stroke="white" strokeOpacity={0.35} strokeDasharray="3 3" />
                    <circle cx={x(M.peakT)} cy={y(M.peakKg)} r={5} fill="var(--warn)" />
                    <text x={x(M.peakT) + 10} y={y(M.peakKg) + 4} className="fill-foreground font-mono text-[11px] max-sm:text-[18px]">
                      {f1(M.peakKg)} kg at {M.peakPct.toFixed(0)}%
                    </text>
                  </g>

                  {/* release at half threshold */}
                  <g className={fade} style={{ opacity: lit("release") }}>
                    <line x1={PX0} x2={PX1} y1={y(M.threshold / 2)} y2={y(M.threshold / 2)} stroke="var(--warn)" strokeOpacity={0.7} strokeDasharray="4 4" />
                    <line x1={x(M.releaseT)} x2={x(M.releaseT)} y1={y(M.threshold / 2) - 24} y2={y(0) + 6} stroke="var(--warn)" strokeWidth={1.5} />
                    <text x={x(M.releaseT) + 8} y={y(M.threshold / 2) - 10} className="fill-warn font-mono text-[10px] max-sm:text-[17px]">
                      release
                    </text>
                  </g>

                  {cursor}
                </svg>
              )}

              {!isLive && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-3 right-3 inline-flex items-center gap-2 rounded-full border border-trace/30 bg-panel/90 px-3 py-1 text-xs text-trace transition-colors duration-200 group-hover/chart:border-trace/70 sm:text-sm"
                >
                  <span className="rt-blink size-1.5 rounded-full bg-trace" />
                  <span className="[@media(pointer:coarse)]:hidden">Press and hold to row your own</span>
                  <span className="hidden [@media(pointer:coarse)]:inline">Tap to row your own</span>
                </span>
              )}
              {isLive && live.strokes.length === 0 && live.state === "ready" && held === "none" && (
                <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
                  <p className="rounded-md border border-line bg-panel/90 px-4 py-3 text-center text-sm leading-relaxed sm:text-base">
                    Press and hold anywhere on the chart.
                    <span className="block text-muted-foreground">Raise for more force. Let go to release.</span>
                  </p>
                </div>
              )}
            </div>

            {/* where in the stroke the cursor (or the live detector) is */}
            <ol aria-label="Phases of the stroke" className="readout flex justify-between gap-2 border-t border-line px-4 py-2.5 text-xs sm:text-[0.8125rem]">
              {PHASES.map((p) => (
                <li
                  key={p}
                  aria-current={phase === p ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 transition-colors duration-200",
                    phase === p ? "text-trace" : "text-muted-foreground"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full transition-[background-color,box-shadow,transform] duration-200",
                      phase === p ? "scale-125 bg-trace shadow-[0_0_8px_rgb(34_227_239/0.8)]" : "bg-white/35"
                    )}
                  />
                  {p}
                </li>
              ))}
            </ol>

            {/* drive : recovery, to scale */}
            {/* The bar dims when another measure is picked; the words stay
                readable, which dimming the whole block would not. */}
            <div className="border-t border-line px-4 py-3">
              <div
                className={cn("flex h-2 overflow-hidden rounded-full bg-white/[0.06]", fade)}
                style={{ opacity: 0.45 + 0.55 * lit("rhythm") }}
                aria-hidden
              >
                <div className="bg-trace transition-[flex-grow] duration-500 ease-out" style={{ flexGrow: rhythm.drive }} />
                <div className="bg-white/15 transition-[flex-grow] duration-500 ease-out" style={{ flexGrow: rhythm.recovery }} />
              </div>
              <div className="readout mt-2 flex justify-between text-xs text-muted-foreground">
                <span>drive {rhythm.drive ? rhythm.drive.toFixed(0) : "—"} ms</span>
                <span>recovery {rhythm.recovery ? rhythm.recovery.toFixed(0) : "—"} ms</span>
              </div>
            </div>
          </div>

          {isLive && (
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
              <button
                type="button"
                aria-describedby={hintId}
                {...on?.holdButton}
                className={cn(ctaSecondary, "h-11 touch-none px-4 select-none", held === "hold" && "border-trace/60 bg-trace/10 text-trace")}
              >
                Hold to pull
              </button>
              <p id={hintId} className="order-last w-full text-sm text-muted-foreground sm:order-none sm:w-auto sm:min-w-0 sm:flex-1">
                Hold it, or Space on it, for one stroke. Or press on the chart and raise for more force.
              </p>
              <button
                type="button"
                onClick={on?.clear}
                className="ml-auto min-h-11 px-1 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace sm:ml-0"
              >
                Clear
              </button>
            </div>
          )}

          <div aria-live={isLive ? undefined : "polite"} className="mt-5 min-h-[7.5rem] bg-background">
            <p className="type-h3">
              {current.label} <span className="readout ml-2 text-base font-normal text-trace">{shown.value}</span>
            </p>
            <p className="type-body mt-2 max-w-[62ch] text-muted-foreground">{shown.body}</p>
          </div>
          <p className="sr-only" aria-live="polite">
            {isLive ? live.note : ""}
          </p>
        </div>
      </div>

      <p className="mt-8 max-w-[70ch] text-sm text-muted-foreground">
        {isLive
          ? "Your input stands in for force: height on the chart sets the kilograms. The measuring is the node's own: the same catch and release logic, thresholds and sums its firmware runs, at 80 readings a second."
          : "Example data."}
      </p>
    </div>
  );
}
