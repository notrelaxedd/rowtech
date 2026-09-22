"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import { IDLE_INPUT } from "./curve-explorer-model";
import { CurveExplorerView, type CurveMode } from "./curve-explorer-view";
import { emptySummary, type Input, type LiveSummary, type MetricId } from "./stroke-live-types";
import { H, KG1, W, kgAtY } from "./stroke-frame";

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
      liveChart={<LiveChart input={input} summary={live} onSummary={setLive} readout={readout} active={active} />}
      on={{
        go,
        setActive,
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
          if (input.current.src !== "pointer") return;
          // A mouse moving with no button down means the release was missed.
          if (e.pointerType === "mouse" && e.buttons === 0) return letGo();
          input.current.kg = kgAt(e.clientY);
        },
        up: () => {
          if (input.current.src === "pointer") letGo();
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
