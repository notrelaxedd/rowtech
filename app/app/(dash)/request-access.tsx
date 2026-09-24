import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { ctaPrimary, ctaSecondary } from "@/components/site/cta";
import { cn } from "@/lib/utils";

/** Signed in, but not on the beta list. */
export function RequestAccess({ email, signOut }: { email: string; signOut: () => Promise<void> }) {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">
        <Link href="/" aria-label="RowTech home" className="inline-block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-trace">
          <Logo />
        </Link>
        <h1 className="type-h2 mt-8 text-[2rem]">The dashboard is for beta crews.</h1>
        <p className="type-body mt-5 text-muted-foreground">
          You&rsquo;re signed in as <span className="text-foreground">{email}</span>, which isn&rsquo;t on the beta list
          yet. Apply and tell us about your boat: we&rsquo;ll turn your account on when your crew joins.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/beta" data-cta="app" className={cn(ctaPrimary, "max-sm:w-full")}>
            Apply for the beta
          </Link>
          <form action={signOut} className="max-sm:w-full">
            <button type="submit" className={cn(ctaSecondary, "max-sm:w-full")}>
              Sign out
            </button>
          </form>
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          Already applied, or already rowing with us? Reply to our email and we&rsquo;ll sort it out.
        </p>
      </div>
    </main>
  );
}
