import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { ctaSecondary } from "@/components/site/cta";

export const metadata: Metadata = {
  title: "Application received",
  robots: { index: false },
};

export default function ThanksPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 pt-20 pb-28 sm:px-8 sm:pt-28">
          <p className="readout inline-flex items-center gap-2.5 text-sm text-muted-foreground">
            <span aria-hidden className="size-2 rounded-full bg-ok shadow-[0_0_10px_rgb(61_220_110/0.7)]" />
            <span className="text-ok">SAVED</span>
          </p>
          <h1 className="type-h2 mt-5">Thanks. Your application is in.</h1>
          <p className="type-lead mt-6 max-w-[52ch] text-muted-foreground">
            We&rsquo;ll be in touch by email to talk through your boat and how you&rsquo;d like to use RowTech.
          </p>

          <Link href="/" className={`${ctaSecondary} mt-12`}>
            Back to the site
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
