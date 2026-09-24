"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";

/**
 * An interactive block that costs nothing until it is needed. The server
 * renders `fallback` -- the same view the component draws on its first render
 * -- and the component's own chunk is fetched when the block comes within
 * `margin` of the viewport, or the moment someone points at or tabs into it.
 * The swap is invisible because both render the same markup.
 */
const FOCUSABLE = 'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function island<P extends object>(load: () => Promise<ComponentType<P>>, margin = "400px") {
  function Island(props: P & { fallback: ReactNode; className?: string }) {
    const { fallback, className, ...rest } = props;
    const ref = useRef<HTMLDivElement>(null);
    const started = useRef(false);
    const [C, setC] = useState<ComponentType<P> | null>(null);

    // If keyboard focus is inside the fallback when the island swaps in, hand
    // it to the same control in the live markup instead of dropping it.
    useEffect(() => {
      const el = ref.current;
      if (!C || !el) return;
      const idx = Number(el.dataset.focusIdx ?? -1);
      if (idx < 0) return;
      delete el.dataset.focusIdx;
      el.querySelectorAll<HTMLElement>(FOCUSABLE)[idx]?.focus();
    }, [C]);

    const start = () => {
      if (started.current) return;
      started.current = true;
      load().then((c) => {
        const el = ref.current;
        if (el && el.contains(document.activeElement)) {
          const all = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
          el.dataset.focusIdx = String(all.indexOf(document.activeElement as HTMLElement));
        }
        setC(() => c);
      });
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
export const ForceDeviceIsland = island(() => import("@/components/device/force-device").then((m) => m.ForceDevice));
export const VieveDeviceIsland = island(() => import("@/components/device/vieve-device").then((m) => m.VieveDevice));
