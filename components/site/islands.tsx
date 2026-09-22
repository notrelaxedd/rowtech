"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";

/**
 * An interactive block that costs nothing until it is needed. The server
 * renders `fallback` -- the same view the component draws on its first render
 * -- and the component's own chunk is fetched when the block comes within
 * `margin` of the viewport, or the moment someone points at or tabs into it.
 * The swap is invisible because both render the same markup.
 */
function island<P extends object>(load: () => Promise<ComponentType<P>>, margin = "400px") {
  function Island(props: P & { fallback: ReactNode; className?: string }) {
    const { fallback, className, ...rest } = props;
    const ref = useRef<HTMLDivElement>(null);
    const started = useRef(false);
    const [C, setC] = useState<ComponentType<P> | null>(null);

    const start = () => {
      if (started.current) return;
      started.current = true;
      load().then((c) => setC(() => c));
    };

    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          io.disconnect();
          start();
        },
        { rootMargin: margin }
      );
      io.observe(el);
      return () => io.disconnect();
    }, []);

    return (
      <div ref={ref} className={className} onPointerEnter={start} onFocusCapture={start}>
        {C ? <C {...(rest as P)} /> : fallback}
      </div>
    );
  }
  return Island;
}

export const CurveExplorerIsland = island(() => import("./curve-explorer").then((m) => m.CurveExplorer));
export const ScreenTourIsland = island(() => import("./screen-tour").then((m) => m.ScreenTour));
export const CoxBoxIsland = island(() => import("./cox-box-diagram").then((m) => m.CoxBoxDiagram));
