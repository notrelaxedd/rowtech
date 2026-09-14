"use client";

import { useEffect, useRef } from "react";
import { toPath } from "@/lib/stroke";
import {
  NODE,
  StrokeDetector,
  consistencyCv,
  valueAt,
  type DetectorEvent,
  type Sample,
  type Stroke,
} from "@/lib/stroke-detector";
import { H, KG_GRID, PX0, PX1, W, y } from "./stroke-frame";

// Live mode of the stroke chart. The visitor's input becomes a force signal,
// is sampled 80 times a second with the node's noise and median-of-3, and runs
// through the node's own detector (lib/stroke-detector.ts). The trace is drawn
// straight into the DOM every frame; React only re-renders on detector events.

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

const NOISE = 0.35; // kg, one sigma
const LEAD = 120; // ms of signal kept left of the catch
const FIRST_WIN = 2400;
const MAX_WIN = 6000;

export const emptySummary = (): LiveSummary => ({
  state: "ready",
  strokes: [],
  threshold: NODE.noiseFloorMult * NOISE,
  spm: null,
  cv: null,
  win: { start: 0, len: FIRST_WIN, catchT: null },
  note: "",
});

/** Force while the hold button (or Space on it) is held: a stroke-shaped push. */
function heldForce(s: number) {
  const rise = 1 - Math.exp(-s / 0.11);
  const fade = 1 - 0.45 * Math.min(1, Math.max(0, s - 0.22) / 0.8);
  return 56 * rise * fade;
}

function gauss() {
  const u = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

function median(xs: number[]) {
  if (xs.length < 3) return xs[xs.length - 1];
  const [a, b, c] = xs;
  return Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const f1 = (n: number) => n.toFixed(1);
const label = "fill-muted-foreground font-mono text-[10px] max-sm:text-[17px]";

export function LiveChart({
  input,
  summary,
  onSummary,
  readout,
  active,
}: {
  input: React.RefObject<Input>;
  summary: LiveSummary;
  /** Must be stable (a state setter): the engine restarts when it changes. */
  onSummary: (s: LiveSummary) => void;
  readout: React.RefObject<HTMLSpanElement | null>;
  active: MetricId;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const traceRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const fillRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const cursorRef = useRef<SVGLineElement>(null);

  useEffect(() => {
    const svg = svgRef.current!;
    const trace = traceRef.current!;
    const glow = glowRef.current!;
    const fill = fillRef.current!;
    const head = headRef.current!;
    const cursor = cursorRef.current!;

    const det = new StrokeDetector(NOISE);
    const buf: Sample[] = [];
    const raw: number[] = [];
    let force = 0;
    let next = performance.now();
    let win: Win = { start: next, len: FIRST_WIN, catchT: null };
    let strokes: LiveStroke[] = [];
    let state: LiveState = "ready";
    let spm: number | null = null;
    let lastCatch: number | null = null;
    let shortUntil = 0;
    let note = "";
    let frozen = false;
    let drawnFrozen = false;
    let lastReadout = 0;
    let raf = 0;
    let visible = true;

    const publish = () =>
      onSummary({ state, strokes, threshold: det.threshold(), spm, cv: consistencyCv(strokes), win, note });

    const onEvent = (e: DetectorEvent, now: number) => {
      if (e.kind === "catch") {
        const period = lastCatch === null ? null : e.t - lastCatch;
        const rowing = period !== null && period < NODE.idleMs;
        lastCatch = e.t;
        spm = rowing ? 60000 / period : null;
        const done = e.completed;
        if (done) strokes = strokes.map((s) => (s.seq === done.seq ? { ...s, recoveryMs: done.recoveryMs } : s));
        win = { start: e.t - LEAD, len: rowing ? clamp(period * 1.1, 1200, MAX_WIN) : FIRST_WIN, catchT: e.t };
        frozen = false;
        state = "drive";
        note = "";
      } else if (e.kind === "release") {
        const s = e.stroke;
        strokes = [{ ...s, trace: buf.filter(([t]) => t >= s.catchT - LEAD) }, ...strokes].slice(0, NODE.cvWindow);
        state = "recovery";
        note = `Stroke ${s.seq}: peak ${f1(s.peakKg)} kilograms, ${Math.round(s.peakPct)}% of the way through a ${Math.round(s.driveMs)} millisecond drive.`;
      } else if (e.kind === "discard") {
        state = "short";
        shortUntil = now + 1400;
        note = `Too short to count: ${Math.round(e.driveMs)} milliseconds of drive, under the node's ${NODE.minDriveMs} millisecond minimum.`;
      } else {
        state = "idle";
        spm = null;
      }
      publish();
    };

    // Letting go of the hold button eases the push out over a finish-length
    // taper instead of dropping it, so the release looks like a stroke's.
    let holdLeft = 0;
    let fadeFrom = -1;
    const sample = (ts: number) => {
      const inp = input.current;
      let target = 0;
      if (inp.src === "hold") {
        if (inp.since < 0) inp.since = ts; // the push starts on the sample that sees it
        target = heldForce((ts - inp.since) / 1000);
        holdLeft = target;
        fadeFrom = -1;
      } else if (inp.src === "pointer") {
        target = inp.kg;
        holdLeft = 0;
      } else if (holdLeft > 0) {
        if (fadeFrom < 0) fadeFrom = ts;
        const k = Math.min(1, (ts - fadeFrom) / 260);
        target = holdLeft * 0.5 * (1 + Math.cos(Math.PI * k));
        if (k >= 1) holdLeft = 0;
      }
      // A handle can't jump: the force follows the input with a short lag.
      force += (target - force) * (1 - Math.exp(-NODE.sampleMs / (target > force ? 38 : 60)));
      raw.push(force + gauss() * NOISE);
      if (raw.length > 3) raw.shift();
      const v = median(raw);
      buf.push([ts, v]);
      if (buf.length > 1000) buf.splice(0, 200);
      for (const e of det.push(ts, v)) onEvent(e, ts);
    };

    const X = (t: number) => PX0 + ((t - win.start) / win.len) * (PX1 - PX0);

    const draw = (tEnd: number) => {
      let d = "";
      let hx = 0;
      let hy = 0;
      let area = "";
      const driving = det.state === "drive" && win.catchT !== null;
      for (const [t, v] of buf) {
        if (t < win.start) continue;
        if (t > tEnd) break;
        hx = X(t);
        hy = y(v);
        const pt = `${hx.toFixed(1)} ${hy.toFixed(1)}`;
        d += (d ? "L" : "M") + pt;
        if (driving && t >= win.catchT!) area += (area ? "L" : `M${X(win.catchT!).toFixed(1)} ${y(0).toFixed(1)}L`) + pt;
      }
      trace.setAttribute("d", d);
      glow.setAttribute("d", d);
      fill.setAttribute("d", area ? `${area}L${hx.toFixed(1)} ${y(0).toFixed(1)}Z` : "");
      const live = d && !frozen;
      head.style.visibility = live ? "visible" : "hidden";
      cursor.style.visibility = live ? "visible" : "hidden";
      if (live) {
        head.setAttribute("transform", `translate(${hx.toFixed(1)} ${hy.toFixed(1)})`);
        const cx = X(tEnd).toFixed(1);
        cursor.setAttribute("x1", cx);
        cursor.setAttribute("x2", cx);
      }
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      if (now - next > 250) next = now; // back from a pause: don't replay the gap
      while (next <= now) {
        sample(next);
        next += NODE.sampleMs;
      }
      if (state === "short" && now > shortUntil) {
        state = det.state === "drive" ? "drive" : det.state === "recovery" ? "recovery" : "ready";
        publish();
      }

      const end = win.start + win.len;
      if (!frozen && now > end) {
        if (det.state === "drive" && win.len < MAX_WIN) {
          win = { ...win, len: Math.min(MAX_WIN, win.len + 1000) };
          publish();
        } else if (strokes[0] && strokes[0].catchT === win.catchT) {
          // Hold the finished stroke on screen, like the STROKE page, until the next catch.
          frozen = true;
          drawnFrozen = false;
        } else {
          win = { start: now, len: FIRST_WIN, catchT: null };
          publish();
        }
      }
      if (!frozen || !drawnFrozen) {
        draw(frozen ? end : now);
        drawnFrozen = frozen;
      }

      const el = readout.current;
      if (el && now - lastReadout > 70 && buf.length) {
        lastReadout = now;
        el.textContent = f1(Math.max(0, buf[buf.length - 1][1]));
      }
      raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (visible && !document.hidden && !raf) raf = requestAnimationFrame(frame);
    };
    // Entries can arrive batched (hidden, then shown): only the newest counts.
    const io = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      wake();
    });
    io.observe(svg);
    document.addEventListener("visibilitychange", wake);
    publish();
    wake();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", wake);
    };
  }, [input, readout, onSummary]);

  // ---------------------------------------------------------------- declarative layer
  const { win, strokes } = summary;
  const X = (t: number) => PX0 + ((t - win.start) / win.len) * (PX1 - PX0);
  const cur = strokes[0] && strokes[0].catchT === win.catchT ? strokes[0] : null;
  const ghosts = win.catchT === null ? [] : strokes.filter((s) => s !== cur).slice(0, 7);
  const thr = cur ? cur.threshold : summary.threshold;
  const on = (id: MetricId) => active === id;

  const step = win.len <= 3200 ? 500 : 1000;
  const origin = win.catchT ?? win.start;
  const ticks: Array<{ x: number; text: string }> = [];
  for (let k = Math.ceil((win.start - origin) / step); origin + k * step <= win.start + win.len; k++) {
    const tx = X(origin + k * step);
    if (tx < PX0 - 1 || tx > PX1 - 12) continue;
    const s = (k * step) / 1000;
    ticks.push({ x: tx, text: win.catchT === null ? `${s.toFixed(1)} s` : k === 0 ? "catch" : `${k > 0 ? "+" : "−"}${Math.abs(s).toFixed(1)} s` });
  }

  const between = (tr: Sample[], a: number, b: number) => {
    const pts: Array<[number, number]> = [[X(a), y(valueAt(tr, a))]];
    for (const [t, v] of tr) if (t > a && t < b) pts.push([X(t), y(v)]);
    pts.push([X(b), y(valueAt(tr, b))]);
    return toPath(pts);
  };
  const ghostPath = (s: LiveStroke) => {
    const shift = (win.catchT ?? 0) - s.catchT;
    const pts = s.trace
      .map(([t, v]) => [X(t + shift), y(v)] as [number, number])
      .filter(([px]) => px >= PX0 && px <= PX1);
    return toPath(pts);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={
        cur
          ? `Your stroke ${cur.seq}: peak ${f1(cur.peakKg)} kg at ${cur.peakPct.toFixed(0)}% of a ${cur.driveMs.toFixed(0)} ms drive.`
          : "Live force chart. Press and hold to pull a stroke."
      }
      className="block h-auto w-full"
    >
      {KG_GRID.map((kg) => (
        <g key={kg}>
          <line x1={PX0} x2={PX1} y1={y(kg)} y2={y(kg)} stroke={kg === 0 ? "rgb(255 255 255 / 0.22)" : "rgb(255 255 255 / 0.06)"} />
          <text x={PX0 - 8} y={y(kg) + 4} textAnchor="end" className={label}>
            {kg}
          </text>
        </g>
      ))}
      <text x={PX0 - 8} y={14} textAnchor="end" className={label}>
        kg
      </text>
      {ticks.map((t) => (
        <text key={t.text} x={t.x} y={H - 16} textAnchor="middle" className={label}>
          {t.text}
        </text>
      ))}

      {/* the last strokes, aligned at the catch */}
      <g style={{ opacity: on("consistency") ? 1 : 0.8 }}>
        {ghosts.map((s) => (
          <path
            key={s.seq}
            d={ghostPath(s)}
            fill="none"
            stroke={on("consistency") ? "var(--trace)" : "white"}
            strokeOpacity={on("consistency") ? 0.4 : 0.14}
            strokeWidth={1.25}
            strokeLinejoin="round"
          />
        ))}
      </g>

      {cur && on("thirds") &&
        [0, 1, 2].map((i) => {
          const third = (cur.releaseT - cur.catchT) / 3;
          const a = cur.catchT + i * third;
          const b = a + third;
          return (
            <path
              key={i}
              d={`${between(cur.trace, a, b)}L${X(b).toFixed(1)} ${y(0).toFixed(1)}L${X(a).toFixed(1)} ${y(0).toFixed(1)}Z`}
              fill="var(--trace)"
              fillOpacity={i === 1 ? 0.26 : 0.13}
            />
          );
        })}

      {/* catch threshold: 5x noise until the first stroke, then 15% of the recent peak */}
      <line x1={PX0} x2={PX1} y1={y(thr)} y2={y(thr)} stroke="var(--warn)" strokeOpacity={on("catch") ? 0.8 : 0.4} strokeDasharray="4 4" />
      <text x={PX1} y={y(thr) - 6} textAnchor="end" className="rt-halo fill-warn font-mono text-[10px] max-sm:text-[17px]" fillOpacity={on("catch") ? 1 : 0.7}>
        catch threshold
      </text>
      {cur && on("release") && (
        <line x1={PX0} x2={PX1} y1={y(thr / 2)} y2={y(thr / 2)} stroke="var(--warn)" strokeOpacity={0.7} strokeDasharray="4 4" />
      )}

      {/* the live signal */}
      <path ref={fillRef} fill="var(--trace)" fillOpacity={0.09} />
      <path ref={glowRef} fill="none" stroke="var(--trace)" strokeOpacity={0.16} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
      <path ref={traceRef} fill="none" stroke="var(--trace)" strokeWidth={2.25} strokeLinejoin="round" />
      <line ref={cursorRef} y1={y(KG_GRID[KG_GRID.length - 1]) - 8} y2={y(0)} stroke="white" strokeOpacity={0.14} />
      <g ref={headRef} style={{ visibility: "hidden" }}>
        <circle r={9} fill="var(--trace)" fillOpacity={0.18} />
        <circle r={3.5} fill="var(--trace)" />
      </g>

      {win.catchT !== null && (
        <g>
          <line
            x1={X(win.catchT)}
            x2={X(win.catchT)}
            y1={y(thr) - 18}
            y2={y(0) + 6}
            stroke="var(--warn)"
            strokeOpacity={on("catch") ? 1 : 0.55}
            strokeWidth={1.5}
          />
          <circle key={win.catchT} cx={X(win.catchT)} cy={y(thr)} r={4} fill="none" stroke="var(--warn)" strokeWidth={1.5} className="rt-ping-once" />
        </g>
      )}

      {cur && (
        <g>
          <line
            x1={X(cur.releaseT)}
            x2={X(cur.releaseT)}
            y1={y(thr / 2) - 16}
            y2={y(0) + 6}
            stroke="var(--warn)"
            strokeOpacity={on("release") ? 1 : 0.4}
            strokeWidth={1.5}
          />
          {on("release") && (
            <text x={X(cur.releaseT) + 8} y={y(thr / 2) - 10} className="rt-halo fill-warn font-mono text-[10px] max-sm:text-[17px]">
              release
            </text>
          )}

          {on("catch") && (
            <>
              {cur.trace
                .filter(([t]) => Math.abs(t - cur.catchT) < 45)
                .map(([t, v]) => (
                  <circle key={t} cx={X(t)} cy={y(v)} r={3} fill="var(--background)" stroke="white" strokeWidth={1.25} />
                ))}
              <text x={X(cur.catchT) + 8} y={y(thr) - 22} className="rt-halo fill-warn font-mono text-[11px] max-sm:text-[18px]">
                +{f1(cur.catchLagMs)} ms
              </text>
            </>
          )}

          {on("rise") && (
            <>
              <path d={between(cur.trace, cur.catchT, cur.catchT + 100)} fill="none" stroke="var(--warn)" strokeWidth={4} strokeLinecap="round" />
              <line
                x1={X(cur.catchT)}
                x2={X(cur.catchT + 100)}
                y1={y(valueAt(cur.trace, cur.catchT))}
                y2={y(valueAt(cur.trace, cur.catchT + 100))}
                stroke="white"
                strokeOpacity={0.6}
                strokeDasharray="3 3"
              />
              <text x={X(cur.catchT + 100) + 8} y={y(valueAt(cur.trace, cur.catchT + 100)) + 4} className="rt-halo fill-foreground font-mono text-[11px] max-sm:text-[18px]">
                100 ms
              </text>
            </>
          )}

          {on("peak") && (
            <>
              <line x1={X(cur.peakT)} x2={X(cur.peakT)} y1={y(cur.peakKg)} y2={y(0)} stroke="white" strokeOpacity={0.35} strokeDasharray="3 3" />
              <circle cx={X(cur.peakT)} cy={y(cur.peakKg)} r={5} fill="var(--warn)" />
              <text
                x={X(cur.peakT) + (X(cur.peakT) > PX1 - 150 ? -10 : 10)}
                y={y(cur.peakKg) + 4}
                textAnchor={X(cur.peakT) > PX1 - 150 ? "end" : "start"}
                className="rt-halo fill-foreground font-mono text-[11px] max-sm:text-[18px]"
              >
                {f1(cur.peakKg)} kg at {cur.peakPct.toFixed(0)}%
              </text>
            </>
          )}

          {on("thirds") &&
            cur.thirds.map((v, i) => {
              const third = (cur.releaseT - cur.catchT) / 3;
              return (
                <text key={i} x={X(cur.catchT + (i + 0.5) * third)} y={y(4)} textAnchor="middle" className="rt-halo fill-foreground font-mono text-[11px] max-sm:text-[18px]">
                  {f1(v)}
                </text>
              );
            })}
        </g>
      )}
    </svg>
  );
}
