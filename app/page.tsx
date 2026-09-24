import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { BetaLink, SectionEnd } from "@/components/site/cta";
import { Hero } from "@/components/site/hero";
import { CrewLanes } from "@/components/site/crew-lanes";
import { CurveExplorerIsland } from "@/components/site/islands";
import { DeviceDiagram3D } from "@/components/site/device-diagram-3d";
import { FORCE_DEFAULT_VIEW, FORCE_NOTES, VIEVE_DEFAULT_VIEW, VIEVE_NOTES } from "@/components/site/device-notes";
import { ForceScreen } from "@/components/device/force-screen";
import { DevicePlaceholder } from "@/components/device/device-placeholder";
import { CurveExplorerView } from "@/components/site/curve-explorer-view";
import { CoxBoxView } from "@/components/site/cox-box-view";
import { SessionFiles } from "@/components/site/session-files";
import { PhotoSlot } from "@/components/site/photo-slot";
import { siteUrl } from "@/lib/site";
import { TEAM } from "@/lib/team";
import { cn } from "@/lib/utils";

const wrap = "mx-auto w-full max-w-7xl px-5 sm:px-8";

/** Where a section stands, in words: built, or still being built. */
function Status({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
      <span aria-hidden className="size-2 rounded-[2px] border border-current" />
      {children}
    </p>
  );
}

const STEPS = [
  {
    art: "photo",
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

const BOATHOUSE = [
  {
    t: "Its own WiFi network",
    d: "Each node runs its own network. Join it from a phone, open a browser, and the node’s page is there. There’s no app to install.",
  },
  {
    t: "Calibration, and where it stands",
    d: "The firmware calibrates against up to five known weights and reports its own worst-case error. We haven’t calibrated a node yet, so for now force reads in raw sensor units. The timing measures don’t need calibration.",
  },
] as const;

const SPECS = [
  ["Load cell", "50 kg, in series on the rigger backstay"],
  ["Electronics", "Adafruit Feather ESP32-S3 and an HX711 breakout on a RowTech carrier board, 80 samples a second"],
  ["Catch timing", "Placed on the node to within about 3 ms, interpolated between samples 12.5 ms apart"],
  ["Calibration", "Up to 5 points against known weights; reports its own worst-case error. Not yet run on a node"],
  ["Screen", "3.5″ 480×320 TFT"],
  ["Keys", "VIEW, TARE, POWER"],
  ["Seat number", "Set on the node’s own web page"],
  ["Network", "Its own WiFi network; download from any phone or laptop"],
  ["Storage", "microSD. Per session: strokes.csv, curves.bin, events.csv, meta.json"],
  ["Battery", "3000 mAh"],
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
  "One clock across the boat, with a target of 5 ms for an eight",
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
    a: "The node places each catch to within about 3 ms by interpolating between samples taken 12.5 ms apart. Force is another matter: it needs each node calibrated against known weights, and we haven’t done that yet. Until we do, force reads in raw sensor units.",
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
      founder: TEAM.map((p) => ({ "@type": "Person", name: p.name })),
    },
    {
      "@type": "Product",
      name: "RowTech Force",
      brand: { "@id": `${siteUrl}/#org` },
      category: "Rowing force measurement",
      image: `${siteUrl}/og.png`,
      description:
        "A seat node for rowing: a load cell in the rigger backstay and a 3.5-inch screen. It records the force curve of every stroke and saves each session to microSD. In beta.",
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
        <section id="crew" data-section="crew" className="below-fold py-24 sm:py-32">
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
                one clock. The target is within 5 ms across an eight.
              </p>
            </div>
            <CrewLanes />
          </div>
        </section>

        {/* ---------------------------------------------------- how it works */}
        <section id="how" data-section="how" className="below-fold border-t border-line py-24 sm:py-28">
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
                    {s.art === "photo" ? (
                      <PhotoSlot
                        label="node on backstay"
                        shows="A Force node on a real rigger, with the load cell visible in the backstay."
                        ratio="auto"
                        className="h-full w-full [&>div]:h-full"
                      />
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
        <section id="stroke" data-section="stroke" className="below-fold border-t border-line py-24 sm:py-32">
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

        {/* --------------------------------------------------------- screens */}
        <section id="screens" data-section="screens" className="below-fold border-t border-line py-24 sm:py-28">
          <div className={wrap}>
            <div className="max-w-3xl">
              <h2 className="type-h2">What the rower sees on the water.</h2>
              <p className="type-lead mt-5 text-muted-foreground">
                Their own peak and their own curve, on a 3.5&Prime; screen, with three keys down its edge.
              </p>
            </div>
            <div className="mt-12">
              <DeviceDiagram3D
                kind="force"
                label="Parts of the Force node"
                notes={FORCE_NOTES}
                defaultView={FORCE_DEFAULT_VIEW}
                caption="Force node, concept design. It's wired to a 50 kg load cell in series on the rigger backstay."
                poster={<div className="flex h-full items-center justify-center p-6"><DevicePlaceholder ratio={1180 / 800} name="FORCE" /></div>}
              />
            </div>
            <PhotoSlot
              className="mt-12 max-w-md"
              label="rower's-eye view of screen"
              shows="The node's screen from the seat, mid-outing, as the rower sees it."
            />
          </div>
        </section>

        {/* ----------------------------------------------------------- Vieve */}
        <section id="vieve" data-section="vieve" className="below-fold border-t border-line py-24 sm:py-32">
          <div className={wrap}>
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16">
              <div>
                <Status>In development</Status>
                <h2 className="type-h2 mt-5">Vieve hears every seat.</h2>
              </div>
              <p className="type-lead text-muted-foreground">
                Vieve, the RowTech cox box, will carry the cox&rsquo;s voice to the boat&rsquo;s speakers and be the hub
                every seat node reports to. The target price is $499.
              </p>
            </div>
            <div className="mt-12">
              <CoxBoxView lit={8} />
            </div>
            <div className="mt-14">
              <DeviceDiagram3D
                kind="vieve"
                label="Parts of Vieve"
                notes={VIEVE_NOTES}
                defaultView={VIEVE_DEFAULT_VIEW}
                caption="Vieve V1, concept design."
                poster={<div className="flex h-full items-center justify-center p-6"><DevicePlaceholder ratio={1320 / 760} name="VIEVE" /></div>}
              />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- boathouse */}
        <section id="boathouse" data-section="boathouse" className="below-fold border-t border-line py-24 sm:py-28">
          <div className={wrap}>
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
              <div>
                <h2 className="type-h2">It brings its own network to the dock.</h2>
                <PhotoSlot
                  className="mt-10 hidden lg:block"
                  label="PCB"
                  shows="The RowTech carrier board with the Feather ESP32-S3 and HX711 breakout fitted."
                />
              </div>
              <div>
                <dl className="grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2">
                  {BOATHOUSE.map((f) => (
                    <div key={f.t}>
                      <dt className="type-h3">{f.t}</dt>
                      <dd className="type-body mt-2 text-muted-foreground">{f.d}</dd>
                    </div>
                  ))}
                </dl>
                <details className="group mt-12 border-y border-line">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 text-[1.0625rem] font-semibold [&::-webkit-details-marker]:hidden">
                    Seat node specs
                    <span aria-hidden className="relative size-3.5 shrink-0">
                      <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-muted-foreground" />
                      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-muted-foreground transition-transform duration-200 ease-out group-open:scale-y-0" />
                    </span>
                  </summary>
                  <dl className="divide-y divide-line pb-4">
                    {SPECS.map(([k, v]) => (
                      <div key={k} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:gap-6">
                        <dt className="text-sm font-semibold text-muted-foreground">{k}</dt>
                        <dd className="text-[0.9375rem]">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
                <PhotoSlot
                  className="mt-10 lg:hidden"
                  label="PCB"
                  shows="The RowTech carrier board with the Feather ESP32-S3 and HX711 breakout fitted."
                />
              </div>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------- what's in the beta */}
        <section id="beta-scope" data-section="beta-scope" className="below-fold border-t border-line py-24 sm:py-28">
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
                  Upload a node&rsquo;s four session files, or several seats at once as one outing, and go through it
                  stroke by stroke. So far it has only run on a made-up sample session.
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
        <section id="faq" data-section="faq" className="below-fold border-t border-line py-24 sm:py-28">
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
        <section id="beta" data-section="beta" className="below-fold border-t border-line py-24 sm:py-28">
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
        <section data-section="closing" className="below-fold border-t border-line">
          <div className={cn(wrap, "grid grid-cols-1 items-center gap-12 py-24 sm:py-32 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:gap-16")}>
            <div>
              <h2 className="type-h2 max-w-[16ch]">Tell us about your crew.</h2>
              <p className="type-lead mt-6 max-w-[44ch] text-muted-foreground">
                We&rsquo;re choosing beta crews now.
              </p>
              <div className="mt-10">
                <BetaLink from="closing" className="h-14 px-7 text-base max-sm:w-full" />
              </div>
            </div>
            <PhotoSlot label="boat on the water" shows="A crew rowing with Force nodes fitted, ideally at dawn practice." />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
