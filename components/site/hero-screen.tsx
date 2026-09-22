"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// The node's LIVE screen, running, laid exactly over the screen in the still
// render (device-front.webp: the 480x320 panel sits at these fractions of the
// image, fitted to the pixel against live.png). The still is the LCP and the
// resting state; the screen engine (lib/live-screen.ts) is fetched only once
// the page has loaded and the main thread is idle, and fades in over it.
const PANEL = { left: "13.971%", top: "14.484%", width: "62.206%", height: "71.033%" };

export function HeroScreen() {
  const host = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;
    let raf = 0;
    let visible = true;
    let prev = 0;
    let stop = () => {};

    const boot = async () => {
      const { LiveScreen } = await import("@/lib/live-screen");
      const screen = await LiveScreen.create();
      if (disposed) return;
      screen.canvas.className = "block h-full w-full [image-rendering:pixelated]";
      screen.canvas.setAttribute("aria-hidden", "true");
      el.appendChild(screen.canvas);

      const loop = (now: number) => {
        raf = 0;
        if (disposed || !visible || document.hidden) return;
        screen.step(prev ? (now - prev) / 1000 : 0);
        prev = now;
        raf = requestAnimationFrame(loop);
      };
      const resume = () => {
        if (raf || disposed || !visible || document.hidden) return;
        prev = 0;
        raf = requestAnimationFrame(loop);
      };
      const io = new IntersectionObserver((entries) => {
        visible = entries[entries.length - 1].isIntersecting;
        resume();
      });
      io.observe(el);
      document.addEventListener("visibilitychange", resume);
      stop = () => {
        io.disconnect();
        document.removeEventListener("visibilitychange", resume);
        screen.canvas.remove();
      };
      resume();
      setOn(true);
    };

    // After load, when idle: never in the way of the first paint.
    const idle = (cb: () => void) =>
      "requestIdleCallback" in window ? requestIdleCallback(cb, { timeout: 2500 }) : setTimeout(cb, 300);
    const kick = () => idle(() => void boot().catch(() => {}));
    if (document.readyState === "complete") kick();
    else window.addEventListener("load", kick, { once: true });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("load", kick);
      stop();
    };
  }, []);

  return (
    <div
      ref={host}
      aria-hidden
      style={PANEL}
      className={cn("absolute overflow-hidden transition-opacity duration-500 ease-out", on ? "opacity-100" : "opacity-0")}
    />
  );
}
