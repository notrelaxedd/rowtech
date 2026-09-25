import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { wrap } from "@/components/site/site-page";
import { BetaLink, SectionEnd } from "@/components/site/cta";
import { Hero } from "@/components/site/hero";
import { CrewLanes } from "@/components/site/crew-lanes";
import Image from "next/image";
import Link from "next/link";
import crewOnTheRiver from "@/assets/photos/crew-on-the-river.jpg";
import { CurveExplorerIsland, ForceDeviceIsland, VieveDeviceIsland } from "@/components/site/islands";
import { Status } from "@/components/site/status";
import { ForceScreen } from "@/components/device/force-screen";
import { DevicePlaceholder } from "@/components/device/device-placeholder";
import { CurveExplorerView } from "@/components/site/curve-explorer-view";
import { SessionFiles } from "@/components/site/session-files";
import { ForceMount } from "@/components/device/force-mount";
import { ContactEmail, inlineLink } from "@/components/site/legal";
import { openGraphBase, siteTitle, siteUrl, twitterBase } from "@/lib/site";
import { legalCountry, legalEntity } from "@/lib/owner";
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
    d: "Each node finds each catch and release on its own and starts recording at the first stroke. The rower sees their own peak and curve.",
  },
  {
    art: "files",
    t: "Download the session",
    d: "At the dock, connect your phone to the node’s own Wi-Fi and download the session. You get the numbers for every stroke, the force curve of every stroke, and the timing of everything that happened.",
  },
] as const;

const PRODUCTS = [
  {
    href: "/force",
    name: "Force, the seat node",
    status: null,
    line: "One on each seat’s rigger. It records the force curve of every stroke and shows the rower their own.",
    cta: "See Force and its specifications",
    note: "Concept design. Its screen shows example data, and the Vieve link as designed.",
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

const FAQ = [
  {
    q: "Do we need Wi-Fi at the boathouse?",
    a: "No. Each node runs its own network: join it from a phone or laptop and open a browser. There’s nothing to install.",
  },
  {
    q: "Does it replace our cox box?",
    a: "Not yet. The seat nodes work alongside whatever you already use. Vieve, our own cox box, is in development: it will carry the cox’s voice and tie every seat together.",
  },
  {
    q: "Which boats and riggers does it fit?",
    a: "The load cell mounts on the rigger backstay. For now it fits Vespoli riggers, and more are coming soon. Tell us which boats you row when you apply.",
  },
  {
    q: "Where does the data go?",
    a: "Onto each node’s microSD card, and off it as plain files over the node’s own Wi-Fi.",
  },
  {
    q: "How accurate is it?",
    a: "Timing is measured on the node itself, and it doesn’t need calibration. Force readings do: each node has to be calibrated against known weights, and we haven’t done that yet. Until we do, force reads in raw sensor units. The Force page says where calibration stands.",
  },
  {
    q: "Are you RowTech Solutions?",
    a: `No. RowTech (rowtech.app) is run by ${legalEntity} in ${legalCountry} and isn’t connected to RowTech Solutions, a separate company in Europe that also makes rowing sensors.`,
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
              <h2 className="type-h2 mt-5">See whose catch is early, and who’s carrying the boat.</h2>
              <p className="type-body mt-6 max-w-[58ch] text-muted-foreground">
                A rate meter tells you about the boat. The crew view will show you every seat in it: whose catch lands
                late, who does the work through the middle of the drive, and whether port and starboard pull evenly.
                It needs two things we’re still building: calibration, so every node reads in kilograms, and Vieve,
                the RowTech cox box, which puts every seat on one clock.
              </p>
            </div>
            <CrewLanes />
          </div>
        </section>

        {/* ---------------------------------------------------- how it works */}
        <section id="how" data-section="how" className="border-t border-line py-24 sm:py-28">
          <div className={wrap}>
            <h2 className="type-h2 max-w-2xl">How an outing gets from the rigger to your phone.</h2>
            <ol className="mt-14 grid grid-cols-1 gap-14 md:grid-cols-3 md:gap-8 lg:gap-12">
              {STEPS.map((s, i) => (
                <li key={s.t}>
                  <div className="flex h-64 items-center justify-center lg:h-72">
                    {s.art === "mount" ? (
                      <div className="instrument h-full w-full rounded-md p-3">
                        <ForceMount className="m-0 h-full w-full" />
                      </div>
                    ) : s.art === "device" ? (
                      <figure className="m-0 w-full">
                        <div className="instrument w-full rounded-md p-2">
                          <ForceScreen idPrefix="step" />
                        </div>
                        <figcaption className="mt-3 text-center text-sm text-muted-foreground">
                          The screen shows example data, and the Vieve link as designed.
                        </figcaption>
                      </figure>
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
                Pick a measure to see where it lives on the curve.
              </p>
            </div>
            <div className="mt-12">
              <CurveExplorerIsland
                fallback={<CurveExplorerView active="catch" />}
              />
            </div>
            <SectionEnd from="stroke" apply>
              The node measures each stroke like this, on every seat that has one.
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
                  {"note" in p && <p className="mt-3 text-sm text-muted-foreground">{p.note}</p>}
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

        {/* ------------------------------------------------------- closing */}
        <section id="beta" data-section="closing" className="border-t border-line">
          <div className={cn(wrap, "grid grid-cols-1 items-center gap-12 py-24 sm:py-32 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:gap-16")}>
            <div>
              <h2 className="type-h2 max-w-[16ch]">Tell us about your crew.</h2>
              <p className="type-lead mt-6 max-w-[44ch] text-muted-foreground">
                We’re choosing beta crews now, and new parts have been ordered for Force v1.4. Apply, and we’ll get in
                touch to discuss next steps.
              </p>
              <p className="type-body mt-5 max-w-[48ch] text-muted-foreground">
                Beta crews get testing units at the cost of their materials, and a direct line to the people building
                it. Keep your units, or send them back for a discount on the finished product. If a unit fails, send it
                back and we’ll replace it. Write to <ContactEmail />.
              </p>
              <p className="mt-4 max-w-[48ch] text-sm text-muted-foreground">
                The beta’s terms are on the{" "}
                <Link href="/terms" className={inlineLink}>
                  Terms
                </Link>{" "}
                page.
              </p>
              <div className="mt-10">
                <BetaLink from="closing" className="h-14 px-7 text-base max-sm:w-full" />
              </div>
            </div>
            <Image
              src={crewOnTheRiver}
              alt="A crew rowing a boat down a river, with a city skyline behind them."
              placeholder="blur"
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="aspect-[3/2] w-full rounded-lg object-cover"
            />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
