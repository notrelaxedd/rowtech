import type { PointerEvent, ReactNode, Ref } from "react";
import { EXAMPLE, strokeForce } from "@/lib/stroke";
import { cn } from "@/lib/utils";
import {
  GHOSTS,
  M,
  MAIN,
  METRICS,
  NEAR_CATCH,
  RISE_END,
  PHASES,
  STROKES,
  THIRD_AREAS,
  curve,
  f1,
  third,
  x,
  type MetricId,
  type Phase,
} from "./curve-explorer-model";
import { H, KG_GRID, PX0, PX1, PY1, W, y } from "./stroke-frame";

// The stroke chart's markup, driven entirely by props. With no handlers it is
// the static, server-rendered version the page ships; the client island
// (curve-explorer.tsx) renders the same view with state and handlers wired in,
// so swapping one for the other changes nothing on screen.

export type CurveExplorerViewProps = {
  active: MetricId;
  chartRef?: Ref<HTMLDivElement>;
  /** The phase under the cursor. */
  phase?: Phase | null;
  /** Drawn over the example curve: the cursor that runs along it. */
  cursor?: ReactNode;
  on?: {
    setActive?: (id: MetricId) => void;
    move?: (e: PointerEvent<HTMLDivElement>) => void;
    leave?: () => void;
  };
};

export function CurveExplorerView({ active, chartRef, phase = null, cursor, on }: CurveExplorerViewProps) {
  const lit = (id: MetricId) => (active === id ? 1 : 0);
  const current = METRICS.find((m) => m.id === active)!;
  const fade = "transition-opacity duration-300 ease-out motion-reduce:transition-none";

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18.5rem_minmax(0,1fr)] lg:gap-10">
        <div className="min-w-0">
          <div
            role="group"
            aria-label="Stroke metrics"
            className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-0"
          >
            {METRICS.map((m) => {
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={active === m.id}
                  onClick={on?.setActive && (() => on.setActive!(m.id))}
                  className={cn(
                    "group flex min-h-11 shrink-0 items-baseline justify-between gap-6 rounded-md border px-3.5 py-2.5 text-left transition-colors lg:rounded-none lg:border-x-0 lg:border-t-0 lg:border-b lg:px-1 lg:py-3.5",
                    active === m.id
                      ? "border-trace/50 bg-trace/[0.07] lg:border-line lg:bg-transparent"
                      : "border-line hover:border-foreground/30 lg:hover:border-line"
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
                  <span className="hidden text-sm whitespace-nowrap tabular-nums text-muted-foreground sm:inline">{m.value}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0">
          <div className="instrument overflow-hidden rounded-lg">
            <div className="flex h-12 items-center justify-between gap-3 border-b border-line px-4">
              <p className="flex min-w-0 items-center gap-2 text-xs sm:text-sm">
                <span className="shrink-0 font-semibold text-muted-foreground">Example</span>
                <span className="truncate text-muted-foreground">{` stroke ${EXAMPLE.strokes}, ${EXAMPLE.spm} spm`}</span>
              </p>
              <p className="flex shrink-0 items-baseline gap-1.5 text-xs text-muted-foreground">
                <span>peak</span>
                <span className="readout min-w-[4ch] text-right text-xl text-foreground sm:text-2xl">{f1(EXAMPLE.peakKg)}</span>
                kg
              </p>
            </div>

            <div ref={chartRef} onPointerMove={on?.move} onPointerLeave={on?.leave} className="relative select-none">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label={`Force curve of one stroke. ${current.label}: ${current.value}.`}
              className="block h-auto w-full"
            >
              {KG_GRID.map((kg) => (
                <g key={kg}>
                  <line x1={PX0} x2={PX1} y1={y(kg)} y2={y(kg)} stroke={kg === 0 ? "rgb(255 255 255 / 0.22)" : "rgb(255 255 255 / 0.06)"} />
                  <text x={PX0 - 8} y={y(kg) + 4} textAnchor="end" className="fill-muted-foreground tabular-nums text-[10px] max-sm:text-[17px]">
                    {kg}
                  </text>
                </g>
              ))}
              <text x={PX0 - 8} y={PY1 - 4} textAnchor="end" className="fill-muted-foreground tabular-nums text-[10px] max-sm:text-[17px]">
                kg
              </text>
              {[0, 0.25, 0.5, 0.75, 1].map((s) => (
                <text key={s} x={x(M.catchT + s)} y={H - 16} textAnchor="middle" className="fill-muted-foreground tabular-nums text-[10px] max-sm:text-[17px]">
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
                  <text key={i} x={x(M.catchT + (i + 0.5) * third)} y={y(4)} textAnchor="middle" className="fill-foreground tabular-nums text-[11px] max-sm:text-[18px]">
                    {f1(v)}
                  </text>
                ))}
              </g>

              <path d={MAIN} pathLength={1} fill="none" stroke="var(--trace)" strokeWidth={2.25} strokeLinejoin="round" />

              {/* catch: threshold, raw samples, interpolated crossing */}
              <g className={fade} style={{ opacity: lit("catch") }}>
                <line x1={PX0} x2={PX1} y1={y(M.threshold)} y2={y(M.threshold)} stroke="var(--warn)" strokeOpacity={0.7} strokeDasharray="4 4" />
                <text x={PX1} y={y(M.threshold) - 6} textAnchor="end" className="fill-warn tabular-nums text-[10px] max-sm:text-[17px]">
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
                <text x={x(RISE_END) + 8} y={y(strokeForce(RISE_END)) + 4} className="fill-foreground tabular-nums text-[11px] max-sm:text-[18px]">
                  100 ms
                </text>
              </g>

              {/* peak and its position */}
              <g className={fade} style={{ opacity: lit("peak") }}>
                <line x1={x(M.peakT)} x2={x(M.peakT)} y1={y(M.peakKg)} y2={y(0)} stroke="white" strokeOpacity={0.35} strokeDasharray="3 3" />
                <circle cx={x(M.peakT)} cy={y(M.peakKg)} r={5} fill="var(--warn)" />
                <text x={x(M.peakT) + 10} y={y(M.peakKg) + 4} className="fill-foreground tabular-nums text-[11px] max-sm:text-[18px]">
                  {f1(M.peakKg)} kg at {M.peakPct.toFixed(0)}%
                </text>
              </g>

              {/* release at half threshold */}
              <g className={fade} style={{ opacity: lit("release") }}>
                <line x1={PX0} x2={PX1} y1={y(M.threshold / 2)} y2={y(M.threshold / 2)} stroke="var(--warn)" strokeOpacity={0.7} strokeDasharray="4 4" />
                <line x1={x(M.releaseT)} x2={x(M.releaseT)} y1={y(M.threshold / 2) - 24} y2={y(0) + 6} stroke="var(--warn)" strokeWidth={1.5} />
                <text x={x(M.releaseT) + 8} y={y(M.threshold / 2) - 10} className="fill-warn tabular-nums text-[10px] max-sm:text-[17px]">
                  release
                </text>
              </g>

              {cursor}
            </svg>
            </div>

            {/* where in the stroke the cursor is */}
            <ol aria-label="Phases of the stroke" className="flex justify-between gap-2 border-t border-line px-4 py-2.5 text-xs sm:text-[0.8125rem]">
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
                      phase === p ? "scale-125 bg-trace" : "bg-white/35"
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
                <div className="bg-trace transition-[flex-grow] duration-500 ease-out" style={{ flexGrow: M.driveMs }} />
                <div className="bg-white/15 transition-[flex-grow] duration-500 ease-out" style={{ flexGrow: M.recoveryMs }} />
              </div>
              <div className="mt-2 flex justify-between text-xs tabular-nums text-muted-foreground">
                <span>drive {M.driveMs.toFixed(0)} ms</span>
                <span>recovery {M.recoveryMs.toFixed(0)} ms</span>
              </div>
            </div>
          </div>

          <div aria-live="polite" className="mt-5 min-h-[7.5rem]">
            <p className="type-h3">
              {current.label} <span className="ml-2 text-base font-semibold tabular-nums text-trace">{current.value}</span>
            </p>
            <p className="type-body mt-2 max-w-[62ch] text-muted-foreground">{current.body}</p>
          </div>
        </div>
      </div>

      <p className="mt-8 max-w-[70ch] text-sm text-muted-foreground">Example data.</p>
    </div>
  );
}
