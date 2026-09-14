"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll-reveal wrapper. Everything inside renders fully drawn by default; on
 * mount, if the block is still below the fold (and motion is allowed), it is
 * armed -- `data-reveal="armed"` -- and flips to "in" when it scrolls into view.
 * CSS in globals.css does the rest: `.draw` paths trace themselves (use
 * pathLength={1}), `.pop` marks scale in, `.rise` items slide up, all staggered
 * by `--i`. If JS never runs, nothing is hidden.
 */
export function InView({
  children,
  className,
  threshold = 0.3,
}: {
  children: React.ReactNode;
  className?: string;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.85) return;
    el.dataset.reveal = "armed";
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.dataset.reveal = "in";
        io.disconnect();
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
