"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A box that scrolls sideways when its content is wider than the screen. It's
 * a Tab stop, so the keyboard can scroll it, only while there is something to
 * scroll; without JavaScript it always is one.
 */
export function ScrollRegion({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setScrolls(el.scrollWidth > el.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} role="region" aria-label={label} tabIndex={scrolls ? 0 : undefined} className={className}>
      {children}
    </div>
  );
}
