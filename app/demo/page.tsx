import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { SectionEnd } from "@/components/site/cta";
import { DemoSession } from "@/components/dash/demo-session";

export const metadata: Metadata = {
  title: "See a session",
  description:
    "A whole outing from an eight, seat by seat: every stroke's force curve, peak, rise rate and work by thirds. Made-up sample data, in the RowTech team dashboard.",
};

export default function DemoPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <div className="mx-auto w-full max-w-[110rem] px-4 pt-12 pb-20 sm:px-6 sm:pt-16">
          <div className="max-w-3xl">
            <p className="readout inline-flex items-center gap-2.5 text-sm text-muted-foreground">
              <span aria-hidden className="size-2 rounded-full bg-warn" />
              SAMPLE DATA
            </p>
            <h1 className="type-h2 mt-5">A session, the way a coach reads it.</h1>
            <p className="type-lead mt-5 text-muted-foreground">
              An eight, 147 strokes, every seat measured. Scrub the piece, compare two strokes, or lay one seat over
              another. This is the RowTech team dashboard, on a session we made up so you can poke at it: the numbers
              are computed from the files a node writes, not typed in.
            </p>
          </div>

          <div className="mt-10">
            <DemoSession />
          </div>

          <SectionEnd from="demo">Put your own crew in here: every seat, every stroke, from your next outing.</SectionEnd>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
