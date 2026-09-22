"use client";

import { useEffect, useRef, useState } from "react";
import { watchScroll } from "@/lib/use-scroll";
import { CoxBoxView } from "./cox-box-view";

export function CoxBoxDiagram() {
  const ref = useRef<HTMLElement>(null);
  const [lit, setLit] = useState(8); // fully connected until measured

  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    return watchScroll(el, "through", (p) => {
      // Connect across 30%..62% of the figure's passage through the viewport,
      // i.e. while it rises through the middle of the screen.
      const n = Math.max(0, Math.min(8, Math.floor(((p - 0.3) / 0.32) * 9)));
      setLit((prev) => (prev === n ? prev : n));
    });
  }, []);

  return <CoxBoxView lit={lit} figureRef={ref} />;
}
