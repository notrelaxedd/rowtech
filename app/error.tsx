"use client";

import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { ctaSecondary } from "@/components/site/cta";
import { cn } from "@/lib/utils";

// Anything that throws below the root layout lands here: a page, the
// dashboard's own layout (Supabase not answering who is signed in), a
// component. The reference is the digest in the server's log line.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">
        <Link href="/" aria-label="RowTech home" className="inline-block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-trace">
          <Logo />
        </Link>
        <h1 className="type-h2 mt-8 text-[2rem]">Something went wrong.</h1>
        <p className="type-body mt-5 text-muted-foreground">
          This page didn’t load. Try again, or come back in a few minutes.
        </p>
        <div className="mt-8">
          <button type="button" onClick={() => retry()} className={cn(ctaSecondary, "max-sm:w-full")}>
            Try again
          </button>
        </div>
        {error.digest && <p className="readout mt-8 text-xs text-muted-foreground">Reference {error.digest}</p>}
      </div>
    </main>
  );
}
