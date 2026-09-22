"use client";

import { useEffect, useRef, useState } from "react";
import { CoxBoxView } from "./cox-box-view";

const TICK_MS = 420; // while seats are joining
const BEAT_MS = 1400; // once the crew is on one clock

export function CoxBoxDiagram() {
  const ref = useRef<HTMLElement>(null);
  const [lit, setLit] = useState(8); // matches the static render
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Still below the fold: disconnect the seats, so they can join on screen.
    // Already on screen: leave them connected and just keep the clock.
    const below = el.getBoundingClientRect().top > window.innerHeight * 0.85;
    if (below) setLit(0);

    let n = below ? 0 : 8;
    let timer = 0;
    let visible = false;
    const run = () => {
      window.clearTimeout(timer);
      if (!visible || document.hidden) return;
      if (n < 8) n++;
      setLit(n);
      setTick((t) => t + 1);
      timer = window.setTimeout(run, n < 8 ? TICK_MS : BEAT_MS);
    };
    const io = new IntersectionObserver(
      (entries) => {
        const was = visible;
        visible = entries[entries.length - 1].isIntersecting;
        if (visible && !was) timer = window.setTimeout(run, 350);
        if (!visible) window.clearTimeout(timer);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    const onVis = () => {
      if (!document.hidden && visible) run();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <CoxBoxView lit={lit} tick={tick} figureRef={ref} />;
}
