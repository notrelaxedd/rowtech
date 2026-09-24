"use client";

import { useEffect } from "react";
import { EXAMPLE, measureStroke } from "@/lib/stroke";
import { FORCE_CURVE_GEOMETRY as G } from "./force-screen";

// Runs the Force screen the page has already rendered: the curve draws itself
// through the drive, the big number follows the force and falls back on the
// recovery, then the next catch wipes it -- one stroke every 2.1 seconds, the
// rate the rest of the page uses.
//
// It animates the server-rendered SVG by id rather than owning it, so the
// hero costs a few hundred bytes of JavaScript and nothing at all with
// reduced motion.

const M = measureStroke();
// Played back 1.8x slower than real time, so the eye can follow the drive.
const SLOW = 1.8;
const PERIOD = (60 / EXAMPLE.spm) * 1000 * SLOW;
const DRIVE = M.driveMs * SLOW;
const WIPE = 90 * SLOW; // blank between the release and the next catch

/** Force in kg at a point on the drawn curve. */
const kgAt = (y: number) => ((y - G.y0) / (G.y1 - G.y0)) * G.kgTop;

export function ScreenAnimator({ target = "hero" }: { target?: string }) {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sweep = document.getElementById(`${target}-sweep`);
    const peak = document.getElementById(`${target}-peak`);
    const cursor = document.getElementById(`${target}-cursor`);
    const count = document.getElementById(`${target}-stroke`);
    if (!sweep || !peak || !cursor) return;
    let first = Number(count?.textContent ?? 0);
    let shown = -1;
    let best = 0; // the peak so far this stroke

    const full = G.x1 - G.x0 + 8;
    const host = sweep.closest("svg");
    let raf = 0;
    let visible = true;
    let t0 = 0;

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      // Start at the end of a drive, so the first frame shows a full stroke.
      t0 ||= now - DRIVE;
      const t = (now - t0) % PERIOD;
      // Each catch is a new stroke: the counter in the corner ticks over.
      const n = Math.floor((now - t0) / PERIOD);
      if (n !== shown) {
        shown = n;
        best = 0;
        if (count) count.textContent = String(first + n);
      }

      if (t < DRIVE) {
        // The drive: the trace grows under a cursor, and the peak readout
        // climbs with the force until the stroke tops out.
        const u = t / DRIVE;
        const i = Math.min(G.points.length - 1, Math.round(u * (G.points.length - 1)));
        const [x, y] = G.points[i];
        sweep.setAttribute("width", String(Math.max(0, u * full)));
        cursor.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        cursor.setAttribute("opacity", "1");
        best = Math.max(best, kgAt(y));
        peak.textContent = best.toFixed(1);
      } else if (t < PERIOD - WIPE) {
        // The recovery: the stroke stays up and the peak holds.
        sweep.setAttribute("width", String(full));
        cursor.setAttribute("opacity", "0");
        peak.textContent = M.peakKg.toFixed(1);
      } else {
        // The next catch wipes the graph, as it does on the node.
        sweep.setAttribute("width", "0");
      }
      raf = requestAnimationFrame(frame);
    };

    const resume = () => {
      if (raf || !visible || document.hidden) return;
      // Carry the stroke count across pauses instead of starting over.
      first += Math.max(0, shown);
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
    resume();

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [target]);

  return null;
}
