import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { SignupForm } from "./signup-form";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Apply for the beta",
  description: "Apply to be a RowTech beta crew: seat-by-seat force measurement for rowing coaches and programs.",
  path: "/beta",
});

// Static: which link someone came in on is read in the browser (SignupForm).
export default function BetaPage() {
  return (
    <div className="site flex min-h-full flex-col">
      <SiteHeader cta={false} />
      <main id="main" className="flex-1">
        <div className="mx-auto w-full max-w-xl px-5 pt-12 pb-24 sm:px-8 sm:pt-16">
          <SignupForm />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
