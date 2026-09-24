"use client";

import { useEffect } from "react";

const KEY = "rt_attr";
export const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export type Attribution = Partial<Record<(typeof UTM)[number] | "referrer", string>>;

/** First-touch attribution: remembers where a visitor came from for this tab,
 *  so the beta form can record it even after they browse the landing page. */
export function AttributionCapture() {
  useEffect(() => {
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
  }, []);
  return null;
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
