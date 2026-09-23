"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { analyticsEnabled, startAnalytics, track } from "@/lib/analytics";

/**
 * Site-wide tracking, with no per-component client code:
 *  - `$pageview` on every route, including client-side navigations
 *  - `section_in_view` once per page for every `[data-section]` element
 *  - `cta_click` for every `[data-cta]` link, with its `from` value
 * Renders nothing, and does nothing at all without a PostHog key.
 */
export function Analytics() {
  const path = usePathname();

  useEffect(() => {
    if (!analyticsEnabled) return;
    startAnalytics();
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest<HTMLElement>("[data-cta]");
      if (a) track("cta_click", { from: a.dataset.cta, href: a.getAttribute("href"), path: location.pathname });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  useEffect(() => {
    if (!analyticsEnabled) return;
    track("$pageview", { $current_url: location.href, path });

    const seen = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.section;
          if (!e.isIntersecting || !id || seen.has(id)) continue;
          seen.add(id);
          track("section_in_view", { section: id, path });
          io.unobserve(e.target);
        }
      },
      // "In view" means a real look: a fifth of the section, above the bottom fifth of the screen.
      { threshold: [0.2], rootMargin: "0px 0px -20% 0px" }
    );
    document.querySelectorAll("[data-section]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [path]);

  return null;
}
