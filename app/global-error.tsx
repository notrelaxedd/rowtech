"use client";

import "./globals.css";
import { ctaSecondary } from "@/components/site/cta";

// When the root layout itself fails, this replaces it, so it brings its own
// document and styles (the fonts fall back to the system's).
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="flex min-h-full flex-col">
        <title>Something went wrong | RowTech</title>
        <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-5 py-16">
          <div className="w-full max-w-md">
            <h1 className="type-h2 text-[2rem]">Something went wrong.</h1>
            <p className="type-body mt-5 text-muted-foreground">
              The site didn&rsquo;t load. Try again, or come back in a few minutes.
            </p>
            <div className="mt-8">
              <button type="button" onClick={() => retry()} className={ctaSecondary}>
                Try again
              </button>
            </div>
            {error.digest && <p className="readout mt-8 text-xs text-muted-foreground">Reference {error.digest}</p>}
          </div>
        </main>
      </body>
    </html>
  );
}
