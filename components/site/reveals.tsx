"use client";

import { useEffect } from "react";

/**
 * Scroll reveals for the whole page, from one observer. Any element marked
 * `data-reveal` renders fully drawn by default; if it is still below the fold
 * on load (and motion is allowed) it is armed -- `data-reveal="armed"` -- and
 * flips to "in" when it scrolls into view. CSS in globals.css does the rest:
 * `.draw` paths trace themselves (use pathLength={1}), `.pop` marks scale in,
 * `.rise` items slide up, all staggered by `--i`. Blocks added later (an
 * island swapping in) are picked up too. If JS never runs, nothing is hidden.
 */
export function Reveals() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.reveal = "in";
          io.unobserve(e.target);
        }
      },
      { threshold: 0.2 }
    );
    const arm = (el: HTMLElement) => {
      if (el.dataset.reveal) return; // already armed or played
      if (el.getBoundingClientRect().top < window.innerHeight * 0.85) {
        el.dataset.reveal = "shown";
        return;
      }
      el.dataset.reveal = "armed";
      io.observe(el);
    };
    const scan = (root: ParentNode) => root.querySelectorAll<HTMLElement>('[data-reveal=""]').forEach(arm);
    scan(document);
    const mo = new MutationObserver((records) => {
      for (const r of records)
        r.addedNodes.forEach((n) => {
          if (!(n instanceof HTMLElement)) return;
          if (n.dataset.reveal === "") arm(n);
          scan(n);
        });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
