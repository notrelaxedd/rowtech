"use client";

import { useEffect, useId, useRef, useState } from "react";
import { EXAMPLE, impulseCv, measureStroke, recentStrokes, strokeForce, toPath } from "@/lib/stroke";
import { NODE } from "@/lib/stroke-detector";
import { cn } from "@/lib/utils";
import { ctaSecondary } from "./cta";
import { InView } from "./in-view";
import { LiveChart, emptySummary, type Input, type LiveState, type LiveSummary, type MetricId } from "./live-stroke";
import { H, KG1, KG_GRID, PX0, PX1, PY1, W, kgAtY, y } from "./stroke-frame";

// Everything on this chart is computed from the curve it draws, the way the
// node computes it (lib/stroke.ts measureStroke): no number is typed in. In
// "Row it yourself" the curve is the visitor's, measured live by the node's
// own detector (components/site/live-stroke.tsx).
const STROKES = recentStrokes();
const M = measureStroke();
const CV = impulseCv(STROKES);

const T0 = -0.1;
const T1 = 1.15;
const x = (t: number) => PX0 + ((t - T0) / (T1 - T0)) * (PX1 - PX0);

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
const METRICS: ReadonlyArray<{ id: MetricId; label: string; value: string; body: string }> = [
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
];

/** The same seven measures, read off the visitor's own strokes. */
function liveMetric(id: MetricId, L: LiveSummary): { value: string; body: string } {
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
            value: `${f1(s.peakKg)} kg · ${s.peakPct.toFixed(0)}%`,
            body: `Your peak, and where it fell: ${s.peakPct.toFixed(0)}% of the way through your drive. The shape of the curve says as much as its height.`,
          }
        : { value: "—", body: "The highest force in the drive, and how far through the drive it landed." };
    case "thirds":
      return s
        ? {
            value: `${s.thirds.map((v) => Math.round((v / s.impulse) * 100)).join(" · ")} %`,
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

const STATE: Record<LiveState, { text: string; lamp: string; tone: string }> = {
  ready: { text: "READY", lamp: "bg-white/45", tone: "text-foreground" },
  drive: { text: "DRIVE", lamp: "bg-trace shadow-[0_0_10px_rgb(34_227_239/0.8)]", tone: "text-trace" },
  recovery: { text: "RECOVERY", lamp: "bg-ok shadow-[0_0_10px_rgb(61_220_110/0.7)]", tone: "text-ok" },
  idle: { text: "IDLE", lamp: "bg-white/25", tone: "text-muted-foreground" },
  short: { text: "TOO SHORT", lamp: "bg-warn shadow-[0_0_10px_rgb(255_166_48/0.7)]", tone: "text-warn" },
};

const IDLE_INPUT: Input = { src: "none", kg: 0, since: 0 };

export function CurveExplorer() {
  const [active, setActive] = useState<MetricId>("catch");
  const [mode, setMode] = useState<"example" | "live">("example");
  const [switched, setSwitched] = useState(false);
  const [live, setLive] = useState<LiveSummary>(emptySummary);
  const [session, setSession] = useState(0);
  const [held, setHeld] = useState<Input["src"]>("none");
  const input = useRef<Input>({ ...IDLE_INPUT });
  const chart = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const hintId = useId();

  // Switching windows mid-pull never delivers a pointerup or keyup: let go.
  useEffect(() => {
    const drop = () => {
      if (input.current.src === "none") return;
      input.current = { ...IDLE_INPUT };
      setHeld("none");
    };
    window.addEventListener("blur", drop);
    return () => window.removeEventListener("blur", drop);
  }, []);

  const isLive = mode === "live";
  const on = (id: MetricId) => (active === id ? 1 : 0);
  const current = METRICS.find((m) => m.id === active)!;
  const shown = isLive ? liveMetric(active, live) : current;
  const fade = "transition-opacity duration-300 ease-out motion-reduce:transition-none";
  const st = STATE[live.state];
  const done = live.strokes.find((k) => k.recoveryMs !== null);
  const rhythm = isLive ? { drive: done?.driveMs ?? 0, recovery: done?.recoveryMs ?? 0 } : { drive: M.driveMs, recovery: M.recoveryMs };

  const letGo = () => {
    input.current = { ...IDLE_INPUT };
    setHeld("none");
  };
  const fresh = () => {
    setLive(emptySummary());
    setSession((n) => n + 1);
  };
  const go = (m: "example" | "live") => {
    if (m === mode) return;
    letGo();
    if (m === "live") fresh();
    setMode(m);
    setSwitched(true);
  };

  // Height on the chart is force: the same scale as the axis beside it.
  const kgAt = (clientY: number) => {
    const svg = chart.current?.querySelector("svg");
    if (!svg) return 0;
    const r = svg.getBoundingClientRect();
    return Math.min(KG1 - 1, Math.max(0, kgAtY(((clientY - r.top) / r.height) * H)));
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (!isLive) {
      // On touch, a swipe across the chart must still scroll: switch on tap instead.
      if (e.pointerType === "touch") return;
      go("live");
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    input.current = { src: "pointer", kg: kgAt(e.clientY), since: 0 };
    setHeld("pointer");
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (input.current.src !== "pointer") return;
    // A mouse moving with no button down means the release was missed.
    if (e.pointerType === "mouse" && e.buttons === 0) return letGo();
    input.current.kg = kgAt(e.clientY);
  };
  const onUp = () => {
    if (input.current.src === "pointer") letGo();
  };
  const hold = (down: boolean) => {
    if (down && input.current.src === "none") {
      input.current = { src: "hold", kg: 0, since: -1 };
      setHeld("hold");
    } else if (!down && input.current.src === "hold") letGo();
  };

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
                onClick={() => go(m)}
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
          <InView className="overflow-hidden rounded-lg border border-line bg-panel">
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
                <span key={mode} ref={readout} className="min-w-[4ch] text-right text-xl text-foreground sm:text-2xl">
                  {isLive ? "0.0" : f1(EXAMPLE.peakKg)}
                </span>
                kg
              </p>
            </div>

            <div
              ref={chart}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onLostPointerCapture={onUp}
              onClick={() => !isLive && go("live")}
              className={cn("group/chart relative select-none", isLive ? "cursor-ns-resize touch-none" : "cursor-pointer")}
            >
              {isLive ? (
                <div key={session} className={cn(switched && "rt-swap")}>
                  <LiveChart input={input} summary={live} onSummary={setLive} readout={readout} active={active} />
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

            {/* drive : recovery, to scale */}
            <div className={cn("border-t border-line px-4 py-3", fade)} style={{ opacity: 0.45 + 0.55 * on("rhythm") }}>
              <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                <div className="bg-trace transition-[flex-grow] duration-500 ease-out" style={{ flexGrow: rhythm.drive }} />
                <div className="bg-white/15 transition-[flex-grow] duration-500 ease-out" style={{ flexGrow: rhythm.recovery }} />
              </div>
              <div className="readout mt-2 flex justify-between text-xs text-muted-foreground">
                <span>drive {rhythm.drive ? rhythm.drive.toFixed(0) : "—"} ms</span>
                <span>recovery {rhythm.recovery ? rhythm.recovery.toFixed(0) : "—"} ms</span>
              </div>
            </div>
          </InView>

          {isLive && (
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
              <button
                type="button"
                aria-describedby={hintId}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  hold(true);
                }}
                onPointerUp={() => hold(false)}
                onPointerCancel={() => hold(false)}
                onKeyDown={(e) => {
                  if (e.key !== " " && e.key !== "Enter") return;
                  e.preventDefault();
                  if (!e.repeat) hold(true);
                }}
                onKeyUp={(e) => {
                  if (e.key !== " " && e.key !== "Enter") return;
                  e.preventDefault();
                  hold(false);
                }}
                onBlur={() => hold(false)}
                className={cn(ctaSecondary, "h-11 touch-none px-4 select-none", held === "hold" && "border-trace/60 bg-trace/10 text-trace")}
              >
                Hold to pull
              </button>
              <p id={hintId} className="order-last w-full text-sm text-muted-foreground sm:order-none sm:w-auto sm:min-w-0 sm:flex-1">
                Hold it, or Space on it, for one stroke. Or press on the chart and raise for more force.
              </p>
              <button
                type="button"
                onClick={() => {
                  letGo();
                  fresh();
                }}
                className="ml-auto min-h-11 px-1 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace sm:ml-0"
              >
                Clear
              </button>
            </div>
          )}

          <div aria-live={isLive ? undefined : "polite"} className="mt-5 min-h-[7.5rem]">
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
