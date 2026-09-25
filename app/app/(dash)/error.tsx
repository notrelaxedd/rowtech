"use client";

import { ctaSecondary } from "@/components/site/cta";

// A dashboard page that threw, most often a Supabase read that failed. It shows
// inside the dashboard's header, so the nav and Sign out still work.
export default function DashError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[110rem] px-4 py-8 sm:px-6">
      <h1 className="type-h3 text-2xl">This page didn’t load.</h1>
      <p className="mt-3 max-w-3xl text-[0.9375rem] leading-relaxed text-muted-foreground">
        Something went wrong loading it. Try again, or come back in a few minutes.
      </p>
      <button type="button" onClick={() => retry()} className={`${ctaSecondary} mt-6`}>
        Try again
      </button>
      {error.digest && <p className="readout mt-6 text-xs text-muted-foreground">Reference {error.digest}</p>}
    </div>
  );
}
