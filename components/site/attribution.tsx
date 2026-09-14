"use client";

import { useEffect } from "react";

const KEY = "rt_src";
const PARAMS = ["utm_source", "utm_medium", "utm_campaign", "ref"];

/** First-touch attribution: remembers where a visitor came from for this tab,
 *  so the beta form can record it even after they browse the landing page. */
export function Attribution() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY)) return;
      const q = new URLSearchParams(location.search);
      const parts = PARAMS.filter((p) => q.get(p)).map((p) => `${p}=${q.get(p)}`);
      if (!parts.length && document.referrer) {
        const host = new URL(document.referrer).host;
        if (host && host !== location.host) parts.push(`referrer=${host}`);
      }
      if (parts.length) sessionStorage.setItem(KEY, parts.join("&").slice(0, 150));
    } catch {
      // Storage can be blocked; attribution is a nicety, never a requirement.
    }
  }, []);
  return null;
}

export function readAttribution(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
