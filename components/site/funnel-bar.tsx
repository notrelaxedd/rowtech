"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { BetaLink } from "./cta";
import { cn } from "@/lib/utils";

/**
 * The way in, always within reach once the hero has scrolled away: a slim bar
 * under the header on desktop, a sticky button at the bottom on phones. Both
 * are overlays (fixed / absolute), so appearing never moves the page. They
 * step aside while the closing call to action is on screen.
 */
export function FunnelBar() {
  const [past, setPast] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const hero = document.querySelector('[data-section="hero"]');
    const end = document.querySelector('[data-section="closing"]');
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) setPast(!e.isIntersecting && e.boundingClientRect.top < 0);
        // From the closing section on (footer included) the page has its own CTA.
        if (e.target === end) setClosing(e.isIntersecting || e.boundingClientRect.top < 0);
      }
    });
    if (hero) io.observe(hero);
    if (end) io.observe(end);
    return () => io.disconnect();
  }, []);

  const show = past && !closing;

  return (
    <>
      {/* desktop: slim bar hanging under the sticky header */}
      <div
        aria-hidden={!show}
        inert={!show}
        className={cn(
          "fixed inset-x-0 top-16 z-30 hidden border-b border-line bg-[#0a0d10]/95 backdrop-blur-md transition-[transform,opacity] duration-300 ease-out lg:block motion-reduce:transition-none",
          show ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"
        )}
      >
        <div className="mx-auto flex h-11 max-w-7xl items-center justify-between gap-6 px-8">
          <p className="readout flex items-center gap-2.5 text-sm text-muted-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-ok shadow-[0_0_8px_rgb(61_220_110/0.7)]" />
            Choosing beta crews now. Two minutes to apply, no commitment.
          </p>
          <Link
            href="/beta?from=topbar"
            data-cta="topbar"
            className="group inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-trace hover:text-[#7cf0f6] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-trace"
          >
            Apply now
            <ArrowRight aria-hidden className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {/* phones: a sticky button at the bottom */}
      <div
        aria-hidden={!show}
        inert={!show}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-background/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md transition-[transform,opacity] duration-300 ease-out lg:hidden motion-reduce:transition-none",
          show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"
        )}
      >
        <BetaLink from="sticky" className="w-full" />
      </div>
    </>
  );
}
