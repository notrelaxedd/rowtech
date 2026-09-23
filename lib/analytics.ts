// Product analytics, through PostHog. Client-only.
//
// posthog-js is never in the page bundle: it is imported on first use, after
// the page is idle, and only when NEXT_PUBLIC_POSTHOG_KEY is set. Without a
// key every call here is a no-op. Events raised before the library arrives
// are queued and sent once it does.
type Props = Record<string, string | number | boolean | null | undefined>;
type PostHog = typeof import("posthog-js").default;

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

export const analyticsEnabled = Boolean(KEY);

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;
const queue: Array<[string, Props | undefined]> = [];

function load(): Promise<PostHog | null> {
  if (!KEY || typeof window === "undefined") return Promise.resolve(null);
  loading ??= import("posthog-js").then(({ default: ph }) => {
    ph.init(KEY, {
      api_host: HOST,
      // Page views are sent by us (Analytics component) so client-side
      // navigations count too, with the same shape.
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
      persistence: "localStorage+cookie",
    });
    client = ph;
    for (const [e, p] of queue.splice(0)) ph.capture(e, p);
    return ph;
  });
  return loading;
}

/** Start loading PostHog when the browser is idle. Safe to call repeatedly. */
export function startAnalytics() {
  if (!KEY || loading) return;
  const go = () => void load().catch(() => {});
  if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 1500);
}

export function track(event: string, props?: Props) {
  if (!KEY) return;
  if (client) client.capture(event, props);
  else {
    if (queue.length < 100) queue.push([event, props]);
    startAnalytics();
  }
}
