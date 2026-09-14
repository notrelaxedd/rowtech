import type { Metadata } from "next";
import Image from "next/image";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Beta testing",
  description:
    "Interested in RowTech? Contact us for beta testing. We're recruiting coaches, clubs and programs to row with seat-by-seat force measurement.",
};

const NEXT_STEPS = [
  { t: "We read your application.", d: "Every one, properly." },
  {
    t: "We get in touch by email.",
    d: "To talk through your boat, your rigging, your schedule and what you'd want to learn from the data.",
  },
  { t: "Then you row with it.", d: "And help shape what RowTech becomes." },
];

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
      <SiteHeader />
      <main id="main" className="flex-1">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-14 px-5 pt-14 pb-24 sm:px-8 sm:pt-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20 lg:pb-32">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <h1 className="type-h2">Interested? Contact us for beta testing.</h1>
            <p className="type-lead mt-6 max-w-[44ch] text-muted-foreground">
              Tell us about you and your boat. We want crews of every size and level, so the more you tell us, the
              better.
            </p>

            <ol className="mt-10 space-y-6 border-t border-line pt-8">
              {NEXT_STEPS.map((s, i) => (
                <li key={s.t} className="grid grid-cols-[1.75rem_1fr] gap-3">
                  <span className="readout pt-0.5 text-sm text-trace">{i + 1}</span>
                  <div>
                    <p className="font-semibold">{s.t}</p>
                    <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted-foreground">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-12 hidden lg:block">
              <Image
                src="/product/device-front.webp"
                alt="The RowTech node from the front, showing its LIVE screen."
                width={1360}
                height={794}
                sizes="30vw"
                className="h-auto w-full max-w-md opacity-90"
              />
            </div>
          </div>

          <div className="rounded-xl border border-line bg-panel p-6 sm:p-9">
            <SignupForm from={from} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
