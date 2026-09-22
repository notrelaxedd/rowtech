"use client";

import { useEffect, useRef, useState } from "react";
import type { StrokeRow } from "@/lib/session/format";
import { metric, type MetricId } from "@/lib/session/analyse";

/**
 * Every stroke in the session, one bar each, scrubbable: drag it, click it, or
 * hold an arrow key. It is a slider, so a keyboard walks the piece stroke by
 * stroke (Home, End and PageUp/PageDown jump).
 */
export function StrokeTimeline({
  strokes,
  selected,
  compare,
  metricId,
  onSelect,
  height = 92,
}: {
  strokes: StrokeRow[];
  selected: number;
  /** A second stroke pinned for comparison. */
  compare: number | null;
  metricId: MetricId;
  onSelect: (i: number) => void;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const m = metric(metricId);

  useEffect(() => {
    const canvas = ref.current;
    const parent = box.current;
    if (!canvas || !parent) return;

    const draw = () => {
      const w = parent.clientWidth;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${height}px`;
      const c = canvas.getContext("2d");
      if (!c || !strokes.length) return;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, height);

      const values = strokes.map((s) => m.get(s));
      const hi = Math.max(...values);
      const lo = Math.min(...values);
      // A tight baseline: over a piece these differ by a few percent, and a
      // zero baseline would flatten every one of them into the same bar.
      const pad = (hi - lo || hi || 1) * 0.15;
      const top = hi + pad;
      const bottom = Math.max(0, lo - pad);
      const span = top - bottom || 1;
      const barW = w / strokes.length;

      for (let i = 0; i < strokes.length; i++) {
        const h = Math.max(1, ((values[i] - bottom) / span) * (height - 18));
        const x = i * barW;
        c.fillStyle = i === selected ? "#22e3ef" : i === compare ? "#ffa630" : "rgba(255,255,255,0.22)";
        c.fillRect(x, height - 14 - h, Math.max(1, barW - (barW > 3 ? 1 : 0)), h);
      }

      // the selected stroke, full height
      c.fillStyle = "rgba(34,227,239,0.5)";
      c.fillRect(selected * barW, 0, Math.max(1.5, barW), height - 14);
      c.fillStyle = "#8d9aa6";
      c.font = "10px ui-monospace, monospace";
      c.textAlign = "left";
      c.fillText("1", 2, height - 3);
      c.textAlign = "right";
      c.fillText(String(strokes.length), w - 2, height - 3);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [strokes, selected, compare, m, height]);

  const pick = (clientX: number) => {
    const el = box.current;
    if (!el || !strokes.length) return;
    const r = el.getBoundingClientRect();
    const i = Math.floor(((clientX - r.left) / r.width) * strokes.length);
    onSelect(Math.min(strokes.length - 1, Math.max(0, i)));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const jump: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageDown: -10, PageUp: 10 };
    if (e.key in jump) {
      e.preventDefault();
      onSelect(Math.min(strokes.length - 1, Math.max(0, selected + jump[e.key])));
    } else if (e.key === "Home") {
      e.preventDefault();
      onSelect(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onSelect(strokes.length - 1);
    }
  };

  return (
    <div
      ref={box}
      role="slider"
      tabIndex={0}
      aria-label="Stroke"
      aria-valuemin={1}
      aria-valuemax={strokes.length}
      aria-valuenow={selected + 1}
      aria-valuetext={`Stroke ${selected + 1} of ${strokes.length}`}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) pick(e.clientX);
      }}
      className="relative w-full cursor-ew-resize touch-none rounded-md border border-line bg-[#0b0e11] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace"
    >
      <canvas ref={ref} className="block" />
    </div>
  );
}

const ROW = 34;
const OVERSCAN = 6;

/** The stroke list: only the rows on screen are rendered. */
export function StrokeList({
  strokes,
  selected,
  compare,
  onSelect,
  onCompare,
  height = 320,
}: {
  strokes: StrokeRow[];
  selected: number;
  compare: number | null;
  onSelect: (i: number) => void;
  onCompare: (i: number | null) => void;
  height?: number;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Keep the selected stroke in view when the timeline moves it.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const top = selected * ROW;
    if (top < el.scrollTop || top + ROW > el.scrollTop + el.clientHeight) {
      el.scrollTop = top - el.clientHeight / 2 + ROW / 2;
    }
  }, [selected]);

  const first = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN);
  const last = Math.min(strokes.length, first + Math.ceil(height / ROW) + OVERSCAN * 2);

  return (
    <div
      ref={scroller}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      style={{ height }}
      className="overflow-y-auto rounded-md border border-line bg-panel"
      role="listbox"
      aria-label="Strokes"
      aria-activedescendant={`stroke-${selected}`}
      tabIndex={-1}
    >
      <div style={{ height: strokes.length * ROW }} className="relative">
        {strokes.slice(first, last).map((s, n) => {
          const i = first + n;
          const on = i === selected;
          return (
            <div
              key={s.rec}
              id={`stroke-${i}`}
              role="option"
              aria-selected={on}
              style={{ position: "absolute", top: i * ROW, height: ROW }}
              className={`flex w-full items-center gap-3 px-3 text-sm ${
                on ? "bg-trace/10 text-foreground" : i === compare ? "bg-warn/10" : "text-muted-foreground"
              }`}
            >
              <button type="button" onClick={() => onSelect(i)} className="readout w-10 shrink-0 text-left text-xs hover:text-trace">
                {i + 1}
              </button>
              <span className="readout w-16 shrink-0 tabular-nums">{s.peak.toFixed(1)}</span>
              <span className="readout w-14 shrink-0 tabular-nums">{s.peakPosPct}%</span>
              <span className="readout w-16 shrink-0 tabular-nums">{s.driveMs}</span>
              <button
                type="button"
                onClick={() => onCompare(i === compare ? null : i)}
                className={`ml-auto shrink-0 rounded px-2 py-1 text-xs transition-colors ${
                  i === compare ? "text-warn" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {i === compare ? "comparing" : "compare"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
