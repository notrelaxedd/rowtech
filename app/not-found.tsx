import type { Metadata } from "next";
import Link from "next/link";
import { SitePage, wrap } from "@/components/site/site-page";
import { BetaLink, ctaSecondary } from "@/components/site/cta";
import { cn } from "@/lib/utils";

// Any URL the site doesn't have, and notFound() outside the dashboard (which
// has its own, app/app/(dash)/not-found.tsx). Next adds noindex to a 404.
export const metadata: Metadata = { title: "Page not found" };

const ways = [
  { href: "/", label: "Home" },
  { href: "/force", label: "Force" },
  { href: "/vieve", label: "Vieve" },
];

export default function NotFound() {
  return (
    <SitePage>
      <section className="py-20 sm:py-28">
        <div className={wrap}>
          <h1 className="type-h1 max-w-[16ch]">Page not found.</h1>
          <p className="type-lead mt-6 max-w-[40rem] text-muted-foreground">
            There&rsquo;s no page at this address. The link may be mistyped, or the page may have moved.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            {ways.map((w) => (
              <Link key={w.href} href={w.href} className={cn(ctaSecondary, "max-sm:w-full")}>
                {w.label}
              </Link>
            ))}
            <BetaLink from="not-found" className="max-sm:w-full" />
          </div>
        </div>
      </section>
    </SitePage>
  );
}
