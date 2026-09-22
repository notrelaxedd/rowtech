"use client";

import { useEffect, useRef } from "react";
import { headingUp } from "@/lib/river";
import { MAP, RiverMapView, START } from "./river-map-view";

const LAP_S = 26; // one run down the sketch

export function RiverMap() {
  const map = useRef<SVGGElement>(null);
  const north = useRef<SVGGElement>(null);

  useEffect(() => {
    const g = map.current;
    const n = north.current;
    if (!g || !n || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let p = START;
    let raf = 0;
    let prev = 0;
    let visible = false;
    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      p += (prev ? (now - prev) / 1000 : 0) / LAP_S;
      prev = now;
      if (p > 0.94) {
        // Back to the start: dip the map rather than jump it.
        p = 0.06;
        g.style.opacity = "0";
        window.setTimeout(() => (g.style.opacity = ""), 60);
      }
      const f = headingUp(p, MAP.bx, MAP.by);
      g.setAttribute("transform", f.transform);
      n.setAttribute("transform", `rotate(${(-f.heading).toFixed(2)})`);
      raf = requestAnimationFrame(frame);
    };
    const resume = () => {
      if (raf || !visible || document.hidden) return;
      prev = 0;
      raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      resume();
    });
    io.observe(g.ownerSVGElement ?? g);
    document.addEventListener("visibilitychange", resume);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);

  return <RiverMapView mapRef={map} northRef={north} />;
}
