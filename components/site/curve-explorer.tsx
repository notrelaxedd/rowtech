"use client";

import { useEffect, useRef, useState } from "react";
import { STROKES, metricT, phaseAt, tAtX, x, type MetricId, type Phase } from "./curve-explorer-model";
import { CurveExplorerView } from "./curve-explorer-view";
import { strokeForce } from "@/lib/stroke";
import { PY1, W, y } from "./stroke-frame";

// The interactive stroke chart. Renders the same view as the static version
// the server sends, with a cursor that runs along the example curve: to the
// pointer, or to wherever the picked measure lives.
export function CurveExplorer() {
  const [active, setActive] = useState<MetricId>("catch");
  const [phase, setPhase] = useState<Phase | null>(null);
  const chart = useRef<HTMLDivElement>(null);
  const cursorG = useRef<SVGGElement>(null);
  const cursorLine = useRef<SVGLineElement>(null);
  const cursorDot = useRef<SVGCircleElement>(null);
  const spring = useRef({ t: 0, v: 0, target: 0, shown: false, raf: 0, last: 0 });
  useEffect(() => () => cancelAnimationFrame(spring.current.raf), []);

  // The cursor: a spring toward its target, drawn straight into the SVG.
  const aim = (t: number) => {
    const sp = spring.current;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    sp.target = t;
    if (!sp.shown || still) {
      sp.t = t;
      sp.v = 0;
    }
    sp.shown = true;
    const draw = () => {
      const g = cursorG.current, line = cursorLine.current, dot = cursorDot.current;
      if (!g || !line || !dot) return;
      const cx = x(sp.t).toFixed(1);
      g.style.opacity = "1";
      line.setAttribute("x1", cx);
      line.setAttribute("x2", cx);
      dot.setAttribute("cx", cx);
      dot.setAttribute("cy", y(strokeForce(sp.t, STROKES[0])).toFixed(1));
      const ph = phaseAt(sp.t);
      setPhase((prev) => (prev === ph ? prev : ph));
    };
    const step = (now: number) => {
      sp.raf = 0;
      const dt = Math.min(0.032, sp.last ? (now - sp.last) / 1000 : 0.016);
      sp.last = now;
      // Slightly underdamped: it arrives with a little give, like a handle would.
      const k = 180, c = 2 * Math.sqrt(k) * 0.7;
      sp.v += (k * (sp.target - sp.t) - c * sp.v) * dt;
      sp.t += sp.v * dt;
      draw();
      if (Math.abs(sp.target - sp.t) > 1e-4 || Math.abs(sp.v) > 1e-3) sp.raf = requestAnimationFrame(step);
      else sp.last = 0;
    };
    if (still) return draw();
    if (!sp.raf) sp.raf = requestAnimationFrame(step);
  };

  const tAt = (clientX: number) => {
    const svg = chart.current?.querySelector("svg");
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return tAtX(((clientX - r.left) / r.width) * W);
  };

  return (
    <CurveExplorerView
      active={active}
      chartRef={chart}
      phase={phase}
      cursor={
        <g ref={cursorG} aria-hidden style={{ opacity: 0 }} className="pointer-events-none transition-opacity duration-200">
          <line ref={cursorLine} y1={PY1} y2={y(0)} stroke="white" strokeOpacity={0.35} strokeDasharray="2 3" />
          <circle ref={cursorDot} r={5.5} fill="var(--panel)" stroke="var(--trace)" strokeWidth={2.25} />
        </g>
      }
      on={{
        setActive: (id) => {
          setActive(id);
          aim(metricT(id));
        },
        move: (e) => {
          if (e.pointerType !== "mouse") return;
          const t = tAt(e.clientX);
          if (t !== null) aim(t);
        },
        leave: () => {
          if (spring.current.shown) aim(metricT(active));
        },
      }}
    />
  );
}
