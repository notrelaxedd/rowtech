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
const PERIOD = (60 / EXAMPLE.spm) * 1000;
const DRIVE = M.driveMs;
const WIPE = 90; // ms of blank between the release and the next catch

/** Force in kg at a point on the drawn curve. */
const kgAt = (y: number) => ((y - G.y0) / (G.y1 - G.y0)) * G.kgTop;

export function ScreenAnimator({ target = "hero" }: { target?: string }) {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sweep = document.getElementById(`${target}-sweep`);
    const peak = document.getElementById(`${target}-peak`);
    const cursor = document.getElementById(`${target}-cursor`);
    if (!sweep || !peak || !cursor) return;

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

      if (t < DRIVE) {
        // The drive: the trace grows, the number reads the force under it.
        const u = t / DRIVE;
        const i = Math.min(G.points.length - 1, Math.round(u * (G.points.length - 1)));
        const [x, y] = G.points[i];
        sweep.setAttribute("width", String(Math.max(0, u * full)));
        cursor.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        cursor.setAttribute("opacity", "1");
        peak.textContent = Math.max(0, kgAt(y)).toFixed(1);
      } else if (t < PERIOD - WIPE) {
        // The recovery: the stroke stays up, the number settles back to zero.
        const u = (t - DRIVE) / (PERIOD - WIPE - DRIVE);
        sweep.setAttribute("width", String(full));
        cursor.setAttribute("opacity", "0");
        peak.textContent = (M.peakKg * (1 - u) ** 2).toFixed(1);
      } else {
        // The catch wipes the graph, as it does on the node.
        sweep.setAttribute("width", "0");
        peak.textContent = "0.0";
      }
      raf = requestAnimationFrame(frame);
    };

    const resume = () => {
      if (raf || !visible || document.hidden) return;
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
