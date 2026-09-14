"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BetaLink, ctaSecondary } from "./cta";
import { DeviceStage } from "./device-stage";
import { watchScroll } from "@/lib/use-scroll";
import { cn } from "@/lib/utils";

// The hero pins on large screens for ~1.6 extra viewports while the node turns
// and the camera pushes into its screen. Headline and CTAs stay in view the
// whole time; the rail on the left narrates the three stages.
const BEATS = [
  { t: "Live on the seat", d: "The stroke in hand, wiped at every catch." },
  { t: "Built for the rigger", d: "Its own battery, its own WiFi, one cable." },
  { t: "Every catch, timed", d: "80 readings a second, to within milliseconds." },
];

export function Hero() {
  const section = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const lg = matchMedia("(min-width: 64rem)");
    return watchScroll(el, "pin", (p) => {
      // Unpinned (below lg) the hero scrolls past in a few hundred px: keep to
      // the gentle turn there, and save the push into the screen for desktop.
      progress.current = lg.matches ? p : p * 0.42;
      const b = p < 0.3 ? 0 : p < 0.7 ? 1 : 2;
      setBeat((prev) => (prev === b ? prev : b));
    });
  }, []);

  const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

  return (
    <section ref={section} className="relative lg:h-[260vh] motion-reduce:lg:h-auto">
      <div className="relative overflow-hidden lg:sticky lg:top-16 lg:h-[calc(100svh-4rem)] motion-reduce:lg:static motion-reduce:lg:h-auto">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 right-[-10%] h-[42rem] w-[60rem] rounded-full bg-[radial-gradient(closest-side,rgb(34_227_239/0.14),transparent)]"
        />
        <div className="relative mx-auto grid h-full w-full max-w-7xl grid-cols-1 items-center gap-8 px-5 pt-12 pb-10 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:gap-4 lg:py-0">
          <div>
            <p className="rt-rise readout inline-flex items-center gap-2.5 text-sm text-muted-foreground">
              <span aria-hidden className="rt-blink size-2 rounded-full bg-ok shadow-[0_0_10px_rgb(61_220_110/0.7)]" />
              <span>
                <span className="text-ok">REC</span> · beta, recruiting crews now
              </span>
            </p>
            <h1 className="type-h1 mt-5">
              <span className="rt-rise block" style={d(80)}>Every seat.</span>
              <span className="rt-rise block" style={d(180)}>Every stroke.</span>
              <span className="rt-rise block text-trace" style={d(280)}>Measured.</span>
            </h1>
            <p className="rt-rise type-lead mt-6 max-w-[34rem] text-muted-foreground lg:[@media(max-height:760px)]:hidden" style={d(420)}>
              RowTech puts a force sensor on the rigger of every seat in the boat. Each node records the force curve of
              every stroke, shows it live on the seat, and hands the whole session to the coach when the boat comes in.
            </p>
            <div className="rt-rise mt-8 flex flex-wrap gap-3" style={d(520)}>
              <BetaLink from="hero" className="max-sm:w-full" />
              <Link href="#how" className={cn(ctaSecondary, "max-sm:w-full")}>
                See how it works
              </Link>
            </div>

            <ol aria-label="What the node does" className="rt-rise mt-9 hidden max-w-md border-l border-line lg:block" style={d(640)}>
              {BEATS.map((b, i) => (
                <li
                  key={b.t}
                  className={cn(
                    "relative py-2 pl-5 transition-[color,opacity] duration-500 ease-out motion-reduce:opacity-100",
                    i === beat ? "opacity-100" : "opacity-45"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-0 -left-px h-full w-0.5 origin-top bg-trace transition-transform duration-500 ease-out",
                      i === beat ? "scale-y-100" : "scale-y-0"
                    )}
                  />
                  <p className={cn("font-semibold transition-colors duration-500", i === beat ? "text-trace" : "text-foreground")}>{b.t}</p>
                  <p className="mt-0.5 text-[0.9375rem] leading-relaxed text-muted-foreground">{b.d}</p>
                </li>
              ))}
            </ol>
            <p className="rt-rise mt-5 text-sm text-muted-foreground lg:hidden" style={d(600)}>
              For coaches, clubs and programs. Applying takes two minutes and commits you to nothing.
            </p>
          </div>

          <DeviceStage
            progress={progress}
            className="rt-rise aspect-[4/3] w-full lg:-mr-10 lg:aspect-auto lg:h-[min(78svh,44rem)]"
          />
        </div>
      </div>
    </section>
  );
}
