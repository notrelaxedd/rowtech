"use client";

import { useEffect } from "react";
import { EXAMPLE, measureStroke } from "@/lib/stroke";
import { FORCE_CURVE_GEOMETRY as G } from "./force-screen";

// Runs the Force screen the page has already rendered: the curve draws itself
// through the drive, the big number follows the force and falls back on the
// recovery, then the next catch wipes it -- one stroke every 2.1 seconds, the
// rate the rest of the page uses. It replays the page's example stroke, so
// the stroke counter stays at that stroke's number (147), as everywhere else.
//
// It animates the server-rendered SVG by id rather than owning it, so the
// hero costs a few hundred bytes of JavaScript and nothing at all with
// reduced motion. It starts once the page has loaded and the browser is idle,
// since the screen already shows a finished stroke until then.

const M = measureStroke();
// Played back 1.8x slower than real time, so the eye can follow the drive.
const SLOW = 1.8;
const PERIOD = (60 / EXAMPLE.spm) * 1000 * SLOW;
const DRIVE = M.driveMs * SLOW;
const WIPE = 90 * SLOW; // blank between the release and the next catch
// About 30 frames a second through the drive (the wait runs to the next
// display frame after it); the rest of the stroke holds still, so the
// animator sleeps through it.
const STEP = 24;

/** Force in kg at a point on the drawn curve. */
const kgAt = (y: number) => ((y - G.y0) / (G.y1 - G.y0)) * G.kgTop;

/** Sets an attribute only if it would change: even a write of the same value
 *  costs the browser a style pass. */
function put(el: Element, name: string, value: string) {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

export function ScreenAnimator({ target = "hero" }: { target?: string }) {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sweep = document.getElementById(`${target}-sweep`);
    // The number's own text node: changing its text in place is far cheaper
    // than replacing it (textContent), which restyles the whole page.
    const peak = document.getElementById(`${target}-peak`)?.firstChild;
    const cursor = document.getElementById(`${target}-cursor`);
    if (!sweep || !(peak instanceof Text) || !cursor) return;
    let shown = -1;
    let best = 0; // the peak so far this stroke

    const full = G.x1 - G.x0 + 8;
    const host = sweep.closest("svg");
    let raf = 0;
    let timer = 0;
    let visible = true;
    let started = false;
    let t0 = 0;

    const later = (ms: number) => {
      timer = window.setTimeout(() => {
        timer = 0;
        raf = requestAnimationFrame(frame);
      }, ms);
    };
    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      // Start at the end of a drive, so the first frame shows a full stroke.
      t0 ||= now - DRIVE;
      const t = (now - t0) % PERIOD;
      // Each catch is a new stroke, with a new peak to climb to.
      const n = Math.floor((now - t0) / PERIOD);
      if (n !== shown) {
        shown = n;
        best = 0;
      }

      if (t < DRIVE) {
        // The drive: the trace grows under a cursor, and the peak readout
        // climbs with the force until the stroke tops out.
        const u = t / DRIVE;
        const i = Math.min(G.points.length - 1, Math.round(u * (G.points.length - 1)));
        const [x, y] = G.points[i];
        put(sweep, "width", Math.max(0, u * full).toFixed(1));
        put(cursor, "transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        put(cursor, "opacity", "1");
        best = Math.max(best, kgAt(y));
        const kg = best.toFixed(1);
        if (peak.data !== kg) peak.data = kg;
        later(STEP);
      } else if (t < PERIOD - WIPE) {
        // The recovery: the stroke stays up and the peak holds.
        put(sweep, "width", full.toFixed(1));
        put(cursor, "opacity", "0");
        const kg = M.peakKg.toFixed(1);
        if (peak.data !== kg) peak.data = kg;
        later(PERIOD - WIPE - t);
      } else {
        // The next catch wipes the graph, as it does on the node.
        put(sweep, "width", "0");
        later(PERIOD - t);
      }
    };

    const resume = () => {
      if (!started || raf || timer || !visible || document.hidden) return;
      shown = -1;
      t0 = 0;
      raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      resume();
    });
    if (host) io.observe(host);
    document.addEventListener("visibilitychange", resume);

    // Nothing moves until the page has loaded and the browser has a moment.
    let cancel = () => {};
    const start = () => {
      const go = () => {
        started = true;
        resume();
      };
      if ("requestIdleCallback" in window) {
        const id = requestIdleCallback(go, { timeout: 3000 });
        cancel = () => cancelIdleCallback(id);
      } else {
        const id = setTimeout(go, 1000);
        cancel = () => clearTimeout(id);
      }
    };
    if (document.readyState === "complete") start();
    else addEventListener("load", start, { once: true });

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      removeEventListener("load", start);
      cancel();
      document.removeEventListener("visibilitychange", resume);
    };
  }, [target]);

  return null;
}
