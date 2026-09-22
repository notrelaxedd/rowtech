"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import { STROKES, IDLE_INPUT, metricT, phaseAt, tAtX, x, type Phase } from "./curve-explorer-model";
import { CurveExplorerView, type CurveMode } from "./curve-explorer-view";
import { emptySummary, type Input, type LiveSummary, type MetricId } from "./stroke-live-types";
import { strokeForce } from "@/lib/stroke";
import { H, KG1, PY1, W, kgAtY, y } from "./stroke-frame";

// The interactive stroke chart. Renders the same view as the static version
// the server sends; the live engine (the node's detector, run on the
// visitor's input) is its own chunk, fetched only when "Row it yourself" is
// picked. The placeholder holds the chart's exact box so nothing moves.
const LiveChart = dynamic(() => import("./live-stroke").then((m) => m.LiveChart), {
  ssr: false,
  loading: () => <div aria-hidden style={{ aspectRatio: `${W} / ${H}` }} />,
});

export function CurveExplorer() {
  const [active, setActive] = useState<MetricId>("catch");
  const [mode, setMode] = useState<CurveMode>("example");
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

  // The example curve's cursor: a spring toward wherever the pointer is (or
  // the picked measure lives), drawn straight into the SVG each frame.
  const [phase, setPhase] = useState<Phase | null>(null);
  const cursorG = useRef<SVGGElement>(null);
  const cursorLine = useRef<SVGLineElement>(null);
  const cursorDot = useRef<SVGCircleElement>(null);
  const spring = useRef({ t: 0, v: 0, target: 0, shown: false, raf: 0, last: 0 });
  useEffect(() => () => cancelAnimationFrame(spring.current.raf), []);

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
  const livePhase: Phase | null = live.state === "drive" ? "drive" : live.state === "recovery" ? "recovery" : null;
  const pick = (id: MetricId) => {
    setActive(id);
    if (!isLive) aim(metricT(id));
  };
  const tAt = (clientX: number) => {
    const svg = chart.current?.querySelector("svg");
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return tAtX(((clientX - r.left) / r.width) * W);
  };

  const letGo = () => {
    input.current = { ...IDLE_INPUT };
    setHeld("none");
  };
  const fresh = () => {
    setLive(emptySummary());
    setSession((n) => n + 1);
  };
  const go = (m: CurveMode) => {
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
  const hold = (down: boolean) => {
    if (down && input.current.src === "none") {
      input.current = { src: "hold", kg: 0, since: -1 };
      setHeld("hold");
    } else if (!down && input.current.src === "hold") letGo();
  };

  return (
    <CurveExplorerView
      active={active}
      mode={mode}
      switched={switched}
      live={live}
      held={held}
      session={session}
      hintId={hintId}
      chartRef={chart}
      readoutRef={readout}
      phase={isLive ? livePhase : phase}
      cursor={
        <g ref={cursorG} aria-hidden style={{ opacity: 0 }} className="pointer-events-none transition-opacity duration-200">
          <line ref={cursorLine} y1={PY1} y2={y(0)} stroke="white" strokeOpacity={0.35} strokeDasharray="2 3" />
          <circle ref={cursorDot} r={5.5} fill="var(--background)" stroke="var(--trace)" strokeWidth={2.25} />
        </g>
      }
      liveChart={<LiveChart input={input} summary={live} onSummary={setLive} readout={readout} active={active} />}
      on={{
        go,
        setActive: pick,
        down: (e) => {
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
        },
        move: (e) => {
          if (!isLive && e.pointerType === "mouse") {
            const t = tAt(e.clientX);
            if (t !== null) aim(t);
            return;
          }
          if (input.current.src !== "pointer") return;
          // A mouse moving with no button down means the release was missed.
          if (e.pointerType === "mouse" && e.buttons === 0) return letGo();
          input.current.kg = kgAt(e.clientY);
        },
        up: () => {
          if (input.current.src === "pointer") letGo();
        },
        leave: () => {
          if (!isLive && spring.current.shown) aim(metricT(active));
        },
        clear: () => {
          letGo();
          fresh();
        },
        holdButton: {
          onPointerDown: (e) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            hold(true);
          },
          onPointerUp: () => hold(false),
          onPointerCancel: () => hold(false),
          onKeyDown: (e) => {
            if (e.key !== " " && e.key !== "Enter") return;
            e.preventDefault();
            if (!e.repeat) hold(true);
          },
          onKeyUp: (e) => {
            if (e.key !== " " && e.key !== "Enter") return;
            e.preventDefault();
            hold(false);
          },
          onBlur: () => hold(false),
        },
      }}
    />
  );
}
