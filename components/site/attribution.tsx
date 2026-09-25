"use client";

import { useEffect } from "react";

const KEY = "rt_attr";
const CTA = "rt_cta";
export const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export type Attribution = Partial<Record<(typeof UTM)[number] | "referrer", string>>;

/** First-touch attribution: remembers where a visitor came from for this tab,
 *  so the beta form can record it even after they browse the landing page.
 *  Also notes which beta link (its `data-cta`) was just used, so they can all
 *  go to the one /beta and the form still knows which it was: in
 *  localStorage, so a link opened in a new tab carries it too, and only for a
 *  few minutes and one visit to /beta (see takeCta). */
export function AttributionCapture() {
  useEffect(() => {
    rememberFirstTouch();
    const onUse = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[data-cta]");
      if (!(a instanceof HTMLAnchorElement) || a.pathname !== "/beta" || !a.dataset.cta) return;
      // Middle-click is "auxclick", a long press or right-click "contextmenu".
      if (e.type === "auxclick" && e.button !== 1) return;
      try {
        localStorage.setItem(CTA, JSON.stringify({ cta: a.dataset.cta, at: Date.now() }));
      } catch {}
      // A plain click opens /beta in this tab: let it read the new tag. Any
      // other opens a new tab, which reads it; this tab keeps what it had.
      const here = e.type === "click" && e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && !a.target;
      if (here) taken = undefined;
    };
    // Capture phase: before the link's own handler starts the navigation.
    for (const t of ["click", "auxclick", "contextmenu"] as const) document.addEventListener(t, onUse, { capture: true });
    return () => {
      for (const t of ["click", "auxclick", "contextmenu"] as const) document.removeEventListener(t, onUse, { capture: true });
    };
  }, []);
  return null;
}

function rememberFirstTouch() {
  try {
    if (sessionStorage.getItem(KEY)) return;
    const q = new URLSearchParams(location.search);
    const a: Attribution = {};
    for (const k of UTM) {
      const v = q.get(k);
      if (v) a[k] = v.slice(0, 100);
    }
    // `ref` is the informal version people type into links.
    const ref = q.get("ref");
    if (!a.utm_source && ref) a.utm_source = ref.slice(0, 100);
    if (document.referrer) {
      const host = new URL(document.referrer).host;
      if (host && host !== location.host) a.referrer = host.slice(0, 200);
    }
    sessionStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    // Storage can be blocked; attribution is a nicety, never a requirement.
  }
}

/** How long a used beta link's tag waits for /beta to open. */
const CTA_TTL = 5 * 60_000;
let taken: string | undefined;

/** The `data-cta` of the beta link that opened this /beta, or "". The first
 *  call takes the tag (if it's recent) out of storage, so a later visit
 *  without one, typed or bookmarked, counts as direct; later calls give the
 *  same answer until another beta link is clicked in this tab. */
export function takeCta(): string {
  if (taken !== undefined) return taken;
  taken = "";
  try {
    const raw = localStorage.getItem(CTA);
    localStorage.removeItem(CTA);
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (v && typeof v === "object") {
      const { cta, at } = v as Record<string, unknown>;
      const age = typeof at === "number" ? Date.now() - at : Infinity;
      if (typeof cta === "string" && age >= 0 && age < CTA_TTL) taken = cta;
    }
  } catch {}
  return taken;
}

export function readAttribution(): Attribution {
  try {
    const raw = sessionStorage.getItem(KEY);
    const v: unknown = raw ? JSON.parse(raw) : {};
    if (!v || typeof v !== "object") return {};
    const out: Attribution = {};
    for (const k of [...UTM, "referrer"] as const) {
      const x = (v as Record<string, unknown>)[k];
      if (typeof x === "string" && x) out[k] = x;
    }
    return out;
  } catch {
    return {};
  }
}
