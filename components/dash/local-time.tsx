"use client";

import { useId } from "react";

/**
 * A script that runs as the HTML is parsed, before React hydrates. Rendered
 * as text/plain on the client, so it's inert (and React doesn't warn) when it
 * arrives by client-side navigation instead.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** A value for an inline script: JSON, with nothing that could close the tag. */
export const scriptValue = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

/**
 * A time in the viewer's zone and locale. The server only knows its own, so
 * the text it renders is corrected by an inline script before the page paints,
 * and React keeps the corrected text (suppressHydrationWarning). On a
 * client-side navigation it's formatted in the browser directly. See
 * node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md.
 */
export function LocalTime({ at }: { at: string }) {
  const id = useId();
  return (
    <>
      <time id={id} dateTime={at} suppressHydrationWarning>
        {new Date(at).toLocaleString()}
      </time>
      <InlineScript html={`{var n=document.getElementById(${scriptValue(id)});if(n)n.textContent=new Date(${scriptValue(at)}).toLocaleString()}`} />
    </>
  );
}
