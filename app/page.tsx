import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { wrap } from "@/components/site/site-page";
import { BetaLink, SectionEnd } from "@/components/site/cta";
import { Hero } from "@/components/site/hero";
import { CrewLanes } from "@/components/site/crew-lanes";
import Link from "next/link";
import { CurveExplorerIsland, ForceDeviceIsland, VieveDeviceIsland } from "@/components/site/islands";
import { Status } from "@/components/site/status";
import { ForceScreen } from "@/components/device/force-screen";
import { DevicePlaceholder } from "@/components/device/device-placeholder";
import { CurveExplorerView } from "@/components/site/curve-explorer-view";
import { SessionFiles } from "@/components/site/session-files";
import { ForceMount } from "@/components/device/force-mount";
import { openGraphBase, siteTitle, siteUrl, twitterBase } from "@/lib/site";
import { cn } from "@/lib/utils";

// The title and description are the root layout's defaults.
const shareDescription = "Seat-by-seat force measurement for rowing. Coaches: apply for the beta.";
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { ...openGraphBase, title: siteTitle, description: shareDescription, url: "/" },
  twitter: { ...twitterBase, title: siteTitle, description: shareDescription },
};

const STEPS = [
  {
    art: "mount",
    t: "Fit a node to each seat",
    d: "The load cell goes in the rigger backstay. In the concept design, the node clamps to the stay in front of the rower.",
  },
  {
    art: "device",
    t: "Row",
    d: "Each node finds every catch and release on its own and starts recording at the first stroke. The rower sees their own peak and curve.",
  },
  {
    art: "files",
    t: "Download the practice",
    d: "At the dock, connect your phone to the node’s own WiFi and download the practice. You get the numbers for every stroke, the force curve of every stroke, and the timing of everything that happened.",
  },
] as const;

const PRODUCTS = [
  {
    href: "/force",
    name: "Force, the seat node",
    status: null,
    line: "One on each seat’s rigger. It records the force curve of every stroke and shows the rower their own.",
    cta: "See Force and its specifications",
    drawing: (
      <ForceDeviceIsland
        idPrefix="card-force"
        className="block h-auto w-full"
        fallback={<DevicePlaceholder ratio={1180 / 800} name="FORCE" />}
      />
    ),
  },
  {
    href: "/vieve",
    name: "Vieve, the RowTech cox box",
    status: "In development",
    line: "The cox’s voice to the boat’s speakers, and the hub that puts every seat on one clock.",
    cta: "See Vieve and its specifications",
    drawing: (
      <VieveDeviceIsland
        idPrefix="card-vieve"
        className="block h-auto w-full"
        fallback={<DevicePlaceholder ratio={1320 / 760} name="VIEVE" />}
      />
    ),
  },
] as const;

const BUILT = [
  "A force curve for every stroke",
  "Rate, drive and recovery times, and rhythm",
  "Peak force and where it lands, rise rate, work by thirds",
  "Stroke-to-stroke consistency",
  "Sessions saved to microSD on their own, downloadable as files",
];
const NEXT = [
  "Calibration, so every node reads in kilograms",
  "Vieve: the cox’s voice, GPS time, and the hub every seat reports to",
  "One clock across the boat, so seats can be compared",
  "Catch spread and sequencing, seat by seat",
  "Port and starboard balance",
  "Sessions uploaded from the boat to the team dashboard",
];

const FAQ = [
  {
    q: "Do we need WiFi at the boathouse?",
    a: "No. Each node runs its own network: join it from a phone or laptop and open a browser. There’s nothing to install.",
  },
  {
    q: "Does it replace our cox box?",
    a: "Not yet. The seat nodes work alongside whatever you already use. Vieve, our own cox box, is in development: it will carry the cox’s voice and tie every seat together.",
  },
  {
    q: "Which boats and riggers does it fit?",
    a: "The load cell mounts on the rigger backstay. Tell us which boats you row when you apply.",
  },
  {
    q: "Where does the data go?",
    a: "Onto each node’s microSD card, and off it as plain files over the node’s own WiFi.",
  },
  {
    q: "How accurate is it?",
    a: "Timing is measured on the node itself, and it doesn’t need calibration. Force does: each node has to be calibrated against known weights, and we haven’t done that yet. Until we do, force reads in raw sensor units. The Force page has the numbers.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#org`,
      name: "RowTech",
      url: siteUrl,
      logo: `${siteUrl}/icon.svg`,
      description: "Seat-by-seat force measurement for rowing.",
    },
  ],
};

export default function Home() {
  return (
    <div className="site flex min-h-full flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <main id="main" className="flex-1">
        {/* ------------------------------------------------------------ hero */}
        <Hero />

        {/* ------------------------------------------------------- crew view */}
        <section id="crew" data-section="crew" className="py-24 sm:py-32">
          <div className={cn(wrap, "grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-16")}>
            <div>
              <Status>In development</Status>
              <h2 className="type-h2 mt-5">See whose catch is early, and who&rsquo;s carrying the boat.</h2>
              <p className="type-body mt-6 max-w-[58ch] text-muted-foreground">
                A rate meter tells you about the boat. The crew view will show you every seat in it: whose catch lands
                late, who does the work through the middle of the drive, and whether bow side and stroke side pull evenly.
              </p>
              <p className="type-body mt-4 max-w-[58ch] text-muted-foreground">
                Each node records its own seat today. Comparing seats needs two things we&rsquo;re still building:
                calibration, so every node reads in kilograms, and Vieve, the RowTech cox box, which puts every seat on
                one clock.
              </p>
            </div>
            <CrewLanes />
          </div>
        </section>

        {/* ---------------------------------------------------- how it works */}
        <section id="how" data-section="how" className="border-t border-line py-24 sm:py-28">
          <div className={wrap}>
            <div className="max-w-2xl">
              <h2 className="type-h2">How an outing gets from the rigger to your phone.</h2>
              <p className="type-lead mt-5 text-muted-foreground">
                The node records by itself, and you collect the files over its WiFi.
              </p>
            </div>
            <ol className="mt-14 grid grid-cols-1 gap-14 md:grid-cols-3 md:gap-8 lg:gap-12">
              {STEPS.map((s, i) => (
                <li key={s.t}>
                  <div className="flex h-64 items-center justify-center lg:h-72">
                    {s.art === "mount" ? (
                      <div className="instrument h-full w-full rounded-md p-3">
                        <ForceMount className="m-0 h-full w-full" />
                      </div>
                    ) : s.art === "device" ? (
                      <div className="instrument w-full rounded-md p-2">
                        <ForceScreen idPrefix="step" />
                      </div>
                    ) : (
                      <SessionFiles />
                    )}
                  </div>
                  <p className="mt-6 text-sm font-semibold tabular-nums text-trace">Step {i + 1}</p>
                  <h3 className="type-h3 mt-1">{s.t}</h3>
                  <p className="type-body mt-3 text-muted-foreground">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------ one stroke */}
        <section id="stroke" data-section="stroke" className="border-t border-line py-24 sm:py-32">
          <div className={wrap}>
            <div className="max-w-3xl">
              <h2 className="type-h2">One stroke, taken apart.</h2>
              <p className="type-lead mt-5 text-muted-foreground">
                How fast the blade loads, how high the peak is and where it lands, and where the work goes through the drive.
                The node measures all of it on every stroke. Pick a measure to see where it lives on the curve.
              </p>
            </div>
            <div className="mt-12">
              <CurveExplorerIsland
                fallback={<CurveExplorerView active="catch" />}
              />
            </div>
            <SectionEnd from="stroke" apply>
              The node measures every stroke like this, on every seat that has one.
            </SectionEnd>
          </div>
        </section>

        {/* -------------------------------------------------------- products */}
        <section id="products" data-section="products" className="border-t border-line py-24 sm:py-28">
          <div className={wrap}>
            <h2 className="type-h2 max-w-3xl">Two products, one system.</h2>
            <ul className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-10">
              {PRODUCTS.map((p) => (
                <li key={p.href} className="flex flex-col">
                  <div className="instrument flex aspect-[4/3] items-center justify-center rounded-lg p-6 sm:p-10">
                    {p.drawing}
                  </div>
                  <div className="mt-6">{p.status && <Status>{p.status}</Status>}</div>
                  <h3 className="type-h3 mt-2">{p.name}</h3>
                  <p className="type-body mt-2 max-w-[48ch] text-muted-foreground">{p.line}</p>
                  <p className="mt-5">
                    <Link href={p.href} className="hit-area relative font-semibold text-trace underline-offset-4 hover:underline">
                      {p.cta}
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ----------------------------------------------- what's in the beta */}
        <section id="beta-scope" data-section="beta-scope" className="border-t border-line py-24 sm:py-28">
          <div className={wrap}>
            <h2 className="type-h2 max-w-3xl">Where the build stands.</h2>
            <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-line">
              <div className="lg:pr-12">
                <h3 className="type-h3">In the node&rsquo;s firmware now</h3>
                <ul className="mt-6 space-y-3">
                  {BUILT.map((t) => (
                    <li key={t} className="type-body flex gap-3">
                      <span aria-hidden className="mt-[0.72em] h-0.5 w-3 shrink-0 bg-foreground" />
                      {t}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 max-w-[52ch] text-sm text-muted-foreground">
                  Until a node is calibrated, force reads in raw sensor units. Timing, rate and rhythm don&rsquo;t need
                  calibration.
                </p>
                <h3 className="type-h3 mt-10">The team dashboard</h3>
                <p className="type-body mt-3 max-w-[52ch]">
                  Upload a node&rsquo;s four session files, or several seats as one outing in a zip with a folder per
                  seat, and go through it stroke by stroke. So far it has only run on a made-up sample session.
                </p>
              </div>
              <div className="lg:pl-12">
                <h3 className="type-h3">Coming next</h3>
                <ul className="mt-6 space-y-3">
                  {NEXT.map((t) => (
                    <li key={t} className="type-body flex gap-3 text-muted-foreground">
                      <span aria-hidden className="mt-[0.72em] h-0.5 w-3 shrink-0 border-t-2 border-dotted border-muted-foreground" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- FAQ */}
        <section id="faq" data-section="faq" className="border-t border-line py-24 sm:py-28">
          <div className={wrap}>
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
              <h2 className="type-h2">Questions a coach might ask.</h2>
              <div className="divide-y divide-line border-y border-line">
                {FAQ.map((f) => (
                  <details key={f.q} className="group">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 text-[1.0625rem] font-semibold [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <span aria-hidden className="relative size-3.5 shrink-0">
                        <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-muted-foreground" />
                        <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-muted-foreground transition-transform duration-200 ease-out group-open:scale-y-0" />
                      </span>
                    </summary>
                    <p className="type-body max-w-[65ch] pb-6 text-muted-foreground">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ the beta, plainly */}
        <section id="beta" data-section="beta" className="border-t border-line py-24 sm:py-28">
          <div className={wrap}>
            <h2 className="type-h2 max-w-3xl">Applying for the beta.</h2>
            <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-10">
              <div className="border-t border-line pt-6">
                <h3 className="type-h3">Who it&rsquo;s for</h3>
                <p className="type-body mt-4 max-w-[48ch] text-muted-foreground">High school, college and club coaches, and their crews.</p>
              </div>
              <div className="border-t border-line pt-6">
                <h3 className="type-h3">Applying</h3>
                <p className="type-body mt-4 max-w-[48ch] text-muted-foreground">
                  The form asks for your name, email and program. Which boats you row, where you are and a note are optional.
                </p>
              </div>
              <div className="border-t border-line pt-6">
                <h3 className="type-h3">What beta crews get</h3>
                <ul className="type-body mt-4 space-y-2 text-muted-foreground">
                  <li>Testing units, for now</li>
                  <li>A direct line to the people building it</li>
                  <li>Discounted prices on all RowTech products</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- closing */}
        <section data-section="closing" className="border-t border-line">
          <div className={cn(wrap, "py-24 sm:py-32")}>
            <div>
              <h2 className="type-h2 max-w-[16ch]">Tell us about your crew.</h2>
              <p className="type-lead mt-6 max-w-[44ch] text-muted-foreground">
                We&rsquo;re choosing beta crews now.
              </p>
              <div className="mt-10">
                <BetaLink from="closing" className="h-14 px-7 text-base max-sm:w-full" />
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
