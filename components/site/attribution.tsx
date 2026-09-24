"use client";

import { useEffect } from "react";

const KEY = "rt_attr";
const CTA = "rt_cta";
export const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export type Attribution = Partial<Record<(typeof UTM)[number] | "referrer", string>>;

/** First-touch attribution: remembers where a visitor came from for this tab,
 *  so the beta form can record it even after they browse the landing page.
 *  Also remembers which beta link (its `data-cta`) was used last, so they can
 *  all go to the one /beta and the form still knows which it was. */
export function AttributionCapture() {
  useEffect(() => {
    rememberFirstTouch();
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[data-cta]");
      if (!(a instanceof HTMLAnchorElement) || a.pathname !== "/beta" || !a.dataset.cta) return;
      try {
        sessionStorage.setItem(CTA, a.dataset.cta);
      } catch {}
    };
    // Capture phase: before the link's own handler starts the navigation.
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
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

/** The `data-cta` of the beta link last used in this tab, or "". */
export function readCta(): string {
  try {
    return sessionStorage.getItem(CTA) ?? "";
  } catch {
    return "";
  }
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
