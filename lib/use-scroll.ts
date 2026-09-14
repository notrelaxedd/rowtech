"use client";

import { useEffect, useRef, useState } from "react";

type Mode = "pin" | "through";

/**
 * Scroll progress of an element, 0..1:
 *  - "pin":     0 when its top reaches the viewport top, 1 when its bottom
 *               reaches the viewport bottom (pinned/sticky sections).
 *  - "through": 0 when its top enters the bottom of the viewport, 1 when its
 *               bottom leaves the top.
 * Measured at most once per frame, and only when the page scrolls or resizes.
 */
export function watchScroll(el: HTMLElement, mode: Mode, cb: (p: number) => void) {
  let raf = 0;
  const measure = () => {
    raf = 0;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = mode === "pin" ? -r.top / Math.max(1, r.height - vh) : (vh - r.top) / (r.height + vh);
    cb(Math.min(1, Math.max(0, p)));
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(measure);
  };
  measure();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  };
}

/** Progress in a ref, for per-frame consumers (WebGL) that must not re-render. */
export function useScrollProgress<T extends HTMLElement>(mode: Mode = "through") {
  const ref = useRef<T>(null);
  const progress = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return watchScroll(el, mode, (p) => {
      progress.current = p;
    });
  }, [mode]);
  return { ref, progress };
}

/** Progress quantised into `steps + 1` stages, as state (for UI that changes in stages). */
export function useScrollStep<T extends HTMLElement>(steps: number, mode: Mode = "through", initial = steps) {
  const ref = useRef<T>(null);
  const [step, setStep] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return watchScroll(el, mode, (p) => {
      const s = Math.min(steps, Math.floor(p * (steps + 1)));
      setStep((prev) => (prev === s ? prev : s));
    });
  }, [steps, mode]);
  return { ref, step };
}
