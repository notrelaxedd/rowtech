import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Apply for the beta",
  description:
    "Apply to be a RowTech beta crew: seat-by-seat force measurement for coaches, clubs and programs. Two minutes, no commitment.",
};

export default async function BetaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const raw = typeof q.from === "string" ? q.from : "direct";
  const from = raw.replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "direct";

  return (
    <>
      <SiteHeader cta={false} />
      <main id="main" className="flex-1">
        <div className="mx-auto w-full max-w-xl px-5 pt-12 pb-24 sm:px-8 sm:pt-16">
          <SignupForm from={from} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
