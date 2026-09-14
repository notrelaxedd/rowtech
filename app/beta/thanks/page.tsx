import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { ctaSecondary } from "@/components/site/cta";
import { CopyLink } from "./copy-link";

export const metadata: Metadata = {
  title: "Application received",
  robots: { index: false },
};

export default async function ThanksPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const shareUrl = `${proto}://${host}/beta?from=referral`;

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

          <div className="mt-12 border-t border-line pt-10">
            <h2 className="type-h3">Know a crew that should be in it?</h2>
            <p className="type-body mt-2 max-w-[56ch] text-muted-foreground">
              Send them this link. The more crews row with it, the better it gets for everyone.
            </p>
            <CopyLink url={shareUrl} />
          </div>

          <Link href="/" className={`${ctaSecondary} mt-12`}>
            Back to the site
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
