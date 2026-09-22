import Image from "next/image";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { BetaLink, SectionEnd } from "@/components/site/cta";
import { Hero } from "@/components/site/hero";
import { InView } from "@/components/site/in-view";
import { ScopeStrip } from "@/components/site/scope-strip";
import { CrewLanes } from "@/components/site/crew-lanes";
import { CoxBoxIsland, CurveExplorerIsland, ScreenTourIsland } from "@/components/site/islands";
import { CurveExplorerView } from "@/components/site/curve-explorer-view";
import { ScreenTourView } from "@/components/site/screen-tour-view";
import { CoxBoxView } from "@/components/site/cox-box-view";
import { SessionFiles } from "@/components/site/session-files";
import { ClosingTrace } from "@/components/site/closing-trace";
import { Reveals } from "@/components/site/reveals";
import { emptySummary } from "@/components/site/stroke-live-types";
import { cn } from "@/lib/utils";

const wrap = "mx-auto w-full max-w-7xl px-5 sm:px-8";

function Lamp({ tone }: { tone: "ok" | "trace" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        tone === "ok" && "bg-ok shadow-[0_0_10px_rgb(61_220_110/0.7)]",
        tone === "trace" && "bg-trace shadow-[0_0_10px_rgb(34_227_239/0.7)]"
      )}
    />
  );
}

function Coming({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-trace/30 bg-trace/[0.08] px-3 py-1 text-sm text-trace">
      <Lamp tone="trace" /> {children}
    </p>
  );
}

const STEPS = [
  {
    img: { src: "/product/device-side.webp", alt: "The node from its side, showing the port where the sensor cable enters.", w: 1116, h: 972 },
    t: "Fit a node to each seat",
    d: "The sensor goes on the rigger backstay and cables to the node beside it. Each node runs on its own battery.",
  },
  {
    img: {
      src: "/product/device-stroke.webp",
      alt: "The node showing its STROKE screen: 28.4 strokes a minute, drive and recovery times, peak position and the last stroke’s force curve.",
      w: 1496,
      h: 1030,
    },
    t: "Row",
    d: "Each node finds every catch and release on its own and records from the first stroke. Nobody presses record.",
  },
  {
    t: "Review",
    d: "At the dock, join the node’s WiFi from a phone and download the session: every stroke, every force curve.",
  },
] as const;

const VIEVE = [
  { t: "The cox’s voice", d: "Amplified down the boat, with noise cancellation." },
  { t: "One clock for the crew", d: "Every seat in time to within 5 ms across an eight. That’s what makes catch timing measurable." },
  { t: "GPS, ten times a second", d: "Split, rate, and speed through the drive." },
  { t: "The river, heading-up", d: "A map that turns with the boat, with the most efficient race line on it." },
  { t: "Every seat, live", d: "Force graphs and numbers from each seat on the cox’s screen." },
  { t: "Every outing kept", d: "Past workouts on an SD card, uploaded to the team dashboard over WiFi once you’re ashore." },
] as const;

const BOATHOUSE = [
  { t: "Its own network", d: "Each node runs its own WiFi. Join it from a phone and open a browser. No app, no router, no account." },
  { t: "Switch off without worry", d: "Sessions are saved as they’re recorded. Turning the boat off at the dock never loses the practice." },
  { t: "Lasts the outing", d: "About eight hours on a charge. Charge level sits in the corner of every screen." },
  { t: "Numbers you can trust", d: "Each node is calibrated against known weights and reports its own worst-case error." },
] as const;

const SPECS = [
  ["Sensor", "Force sensor on the rigger backstay"],
  ["Electronics", "HX711 into an ESP32-S3"],
  ["Sampling", "80 samples a second"],
  ["Catch timing", "Detected on the node, to within about 3 ms"],
  ["Calibration", "Up to 5 points against known weights; reports its own worst-case error"],
  ["Screen", "3.5\" TFT: LIVE, STROKE and SESSION"],
  ["Buttons", "TARE, NEXT, UNITS"],
  ["Battery", "About 8 hours"],
  ["Network", "Its own WiFi network; download from any phone or laptop"],
  ["Storage", "SD card. Per session: strokes.csv, curves.bin, events.csv, meta.json"],
] as const;

const TODAY = [
  "A force curve for every stroke, on every seat",
  "Rate, drive and recovery, and rhythm",
  "Peak force and where it lands, rise rate, work by thirds",
  "Stroke-to-stroke consistency",
  "Sessions saved automatically, downloadable as files",
  "The team dashboard: upload a session, go through it stroke by stroke",
];
const NEXT = [
  "Vieve: the cox’s voice, GPS, and the hub every seat reports to",
  "One clock across the boat, within 5 ms for an eight",
  "Catch spread and sequencing, seat by seat",
  "Port and starboard balance",
  "Split, rate and speed through the drive, from 10 Hz GPS",
  "Sessions uploaded from the boat to the team dashboard",
];

const BETA = [
  {
    h: "Who it’s for",
    items: [
      "Coaches, clubs, schools and university programs",
      "Sweep or sculling, any boat size, any level",
      "Crews who want to see inside the boat, not just the rate",
    ],
  },
  {
    h: "What we ask",
    items: [
      "Row with the nodes in your normal outings",
      "Upload your sessions so we can check the measurements",
      "Tell us straight what’s useful and what isn’t",
    ],
  },
  {
    h: "What you get",
    items: [
      "Seat nodes, fitted to your boat",
      "The team dashboard for your sessions",
      "A direct line to the people building it",
      "A say in how Vieve is built",
    ],
  },
] as const;

const FAQ = [
  {
    q: "Do we need WiFi at the boathouse?",
    a: "No. Every node runs its own network. Join it from a phone or laptop and open a browser. There’s nothing to install and nothing to sign in to.",
  },
  {
    q: "Does it replace our cox box?",
    a: "Not yet. Today the seat nodes work alongside whatever you already use. Vieve, our own cox box, will carry the cox’s voice and tie every seat together. We’re building it with our beta crews.",
  },
  {
    q: "Which boats and riggers does it fit?",
    a: "The sensor mounts on the rigger backstay. Tell us what you row when you apply, and we’ll work out fitting it to your boat.",
  },
  {
    q: "Where does the data go?",
    a: "Onto each node’s SD card, and off it as plain files over the node’s own WiFi. Beta crews upload those files to the team dashboard to review them stroke by stroke.",
  },
  {
    q: "How accurate is the force reading?",
    a: "Each node is calibrated against known weights, up to five points, and reports its own worst-case error. Catch timing lands to within about 3 ms.",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {/* ------------------------------------------------------------ hero */}
        <Hero />
        <ScopeStrip />

        {/* ------------------------------------------------------- crew view */}
        <section id="crew" data-section="crew" className="below-fold py-24 sm:py-32">
          <div className={cn(wrap, "grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-16")}>
            <div>
              <Coming>In development</Coming>
              <h2 className="type-h2 mt-6">See who&rsquo;s early. See who&rsquo;s carrying the boat.</h2>
              <p className="type-body mt-6 max-w-[58ch] text-muted-foreground">
                A rate meter tells you about the boat. RowTech shows you every seat in it: whose catch lands late, who does
                the work through the middle of the drive, and whether bow side and stroke side pull evenly.
              </p>
              <p className="type-body mt-4 max-w-[58ch] text-muted-foreground">
                Force from every seat works today. Vieve, the RowTech cox box, puts every seat on one clock, to within 5 ms
                across an eight, and that clock is what makes the crew&rsquo;s catch timing measurable.
              </p>
            </div>
            <CrewLanes />
          </div>
          <div className={wrap}>
            <SectionEnd from="crew">Beta crews see the crew view first, and help decide what it shows.</SectionEnd>
          </div>
        </section>

        {/* ---------------------------------------------------- how it works */}
        <section id="how" data-section="how" className="below-fold border-t border-line bg-[#0a0d10] py-24 sm:py-28">
          <div className={wrap}>
            <div className="max-w-2xl">
              <h2 className="type-h2">Fit it. Row. Review.</h2>
              <p className="type-lead mt-5 text-muted-foreground">No laptop in the launch, no app, no pairing.</p>
            </div>
            <ol className="mt-14 grid grid-cols-1 gap-14 md:grid-cols-3 md:gap-8 lg:gap-12">
              {STEPS.map((s, i) => (
                <li key={s.t}>
                  <div className={cn("flex h-64 items-center lg:h-72", "img" in s && "justify-center")}>
                    {"img" in s ? (
                      <Image
                        src={s.img.src}
                        alt={s.img.alt}
                        width={s.img.w}
                        height={s.img.h}
                        sizes="(min-width: 768px) 30vw, 100vw"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <SessionFiles />
                    )}
                  </div>
                  <p className="readout mt-6 text-sm text-trace">{i + 1}</p>
                  <h3 className="type-h3 mt-2">{s.t}</h3>
                  <p className="type-body mt-3 text-muted-foreground">{s.d}</p>
                </li>
              ))}
            </ol>
            <SectionEnd from="how">We fit the nodes with every beta crew, for the boats you actually row.</SectionEnd>
          </div>
        </section>

        {/* ------------------------------------------------------ one stroke */}
        <section id="stroke" data-section="stroke" className="below-fold py-24 sm:py-32">
          <div className={wrap}>
            <div className="max-w-3xl">
              <h2 className="type-h2">One stroke, taken apart.</h2>
              <p className="type-lead mt-5 text-muted-foreground">
                How fast the blade loads, how high the peak is and where it lands, and where the work goes through the drive.
                The node measures all of it on every stroke. Pick a measure, or row a stroke yourself.
              </p>
            </div>
            <div className="mt-12">
              <CurveExplorerIsland
                fallback={<CurveExplorerView active="catch" mode="example" switched={false} live={emptySummary()} held="none" session={0} />}
              />
            </div>
            <SectionEnd from="stroke">Every seat in your boat, measured like this, on every stroke of every outing.</SectionEnd>
          </div>
        </section>

        {/* --------------------------------------------------------- screens */}
        <section id="screens" data-section="screens" className="below-fold border-y border-line bg-[#0a0d10] py-24 sm:py-28">
          <div className={wrap}>
            <div className="max-w-3xl">
              <h2 className="type-h2">Three buttons. Nothing to set up afloat.</h2>
              <p className="type-lead mt-5 text-muted-foreground">
                The middle button always means NEXT, and holding it always brings you back to LIVE, so nobody gets lost
                mid-piece.
              </p>
            </div>
            <div className="mt-12">
              <ScreenTourIsland fallback={<ScreenTourView i={0} />} />
            </div>
            <SectionEnd from="screens">Your crew will have it figured out by the first paddle. Beta crews tell us what else belongs on the screen.</SectionEnd>
          </div>
        </section>

        {/* ----------------------------------------------------------- Vieve */}
        <section id="vieve" data-section="vieve" className="below-fold py-24 sm:py-32">
          <div className={wrap}>
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16">
              <div>
                <Coming>Now in development</Coming>
                <h2 className="type-h2 mt-6">Vieve hears every seat.</h2>
              </div>
              <p className="type-lead text-muted-foreground">
                It does the job every cox relies on, and it&rsquo;s the hub every seat node reports to. Target price for the
                hub: $250&ndash;300.
              </p>
            </div>
            <div className="mt-12">
              <CoxBoxIsland fallback={<CoxBoxView lit={8} />} />
            </div>
            <dl className="mt-14 grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {VIEVE.map((f) => (
                <div key={f.t}>
                  <dt className="type-h3">{f.t}</dt>
                  <dd className="type-body mt-2 text-muted-foreground">{f.d}</dd>
                </div>
              ))}
            </dl>
            <SectionEnd from="vieve">Vieve is being built with our beta crews. Apply and help decide what goes on it.</SectionEnd>
          </div>
        </section>

        {/* ------------------------------------------------------- boathouse */}
        <section id="boathouse" data-section="boathouse" className="below-fold border-t border-line bg-[#0a0d10] py-24 sm:py-28">
          <div className={wrap}>
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
              <h2 className="type-h2">Made for the boathouse, not the lab.</h2>
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
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 text-[1.0625rem] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace [&::-webkit-details-marker]:hidden">
                    Seat node specs
                    <span aria-hidden className="relative size-3.5 shrink-0">
                      <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-muted-foreground" />
                      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-muted-foreground transition-transform duration-200 ease-out group-open:scale-y-0" />
                    </span>
                  </summary>
                  <dl className="divide-y divide-line pb-4">
                    {SPECS.map(([k, v]) => (
                      <div key={k} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[9rem_1fr] sm:gap-6">
                        <dt className="readout text-sm text-muted-foreground">{k}</dt>
                        <dd className="text-[0.9375rem]">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </div>
            </div>
            <SectionEnd from="boathouse">Nothing to install and nothing to plug in at the dock. It just rows.</SectionEnd>
          </div>
        </section>

        {/* ----------------------------------------------- what's in the beta */}
        <section id="beta-scope" data-section="beta-scope" className="below-fold border-t border-line py-24 sm:py-28">
          <div className={wrap}>
            <h2 className="type-h2 max-w-3xl">What&rsquo;s in the beta.</h2>
            <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-line">
              <div className="lg:pr-12">
                <h3 className="type-h3 flex items-center gap-2.5">
                  <Lamp tone="ok" /> Working today
                </h3>
                <InView>
                  <ul className="mt-6 space-y-3">
                    {TODAY.map((t, i) => (
                      <li key={t} className="rise type-body flex gap-3 text-muted-foreground" style={{ "--i": i } as React.CSSProperties}>
                        <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-ok/70" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </InView>
              </div>
              <div className="lg:pl-12">
                <h3 className="type-h3 flex items-center gap-2.5">
                  <Lamp tone="trace" /> Coming next, built with beta crews
                </h3>
                <InView>
                  <ul className="mt-6 space-y-3">
                    {NEXT.map((t, i) => (
                      <li key={t} className="rise type-body flex gap-3 text-muted-foreground" style={{ "--i": i + 3 } as React.CSSProperties}>
                        <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-trace/70" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </InView>
              </div>
            </div>
            <SectionEnd from="beta-scope">Everything in the right-hand column gets built with beta crews in the boat.</SectionEnd>
          </div>
        </section>

        {/* ------------------------------------------------------------- FAQ */}
        <section id="faq" data-section="faq" className="below-fold border-t border-line bg-[#0a0d10] py-24 sm:py-28">
          <div className={wrap}>
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
              <h2 className="type-h2">Questions coaches ask first.</h2>
              <div className="divide-y divide-line border-y border-line">
                {FAQ.map((f) => (
                  <details key={f.q} className="group">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 text-[1.0625rem] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace [&::-webkit-details-marker]:hidden">
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
            <SectionEnd from="faq">Anything we haven&rsquo;t answered, ask us in your application.</SectionEnd>
          </div>
        </section>

        {/* ------------------------------------------------ the beta, plainly */}
        <section id="beta" data-section="beta" className="below-fold border-t border-line py-24 sm:py-28">
          <div className={wrap}>
            <h2 className="type-h2 max-w-3xl">The beta, plainly.</h2>
            <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8 lg:gap-12">
              {BETA.map((b) => (
                <div key={b.h} className="border-t border-line pt-6">
                  <h3 className="type-h3">{b.h}</h3>
                  <ul className="mt-5 space-y-3">
                    {b.items.map((t) => (
                      <li key={t} className="type-body flex gap-3 text-muted-foreground">
                        <span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-trace/70" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <SectionEnd from="beta">Seat nodes for your boat, the dashboard, and a hand in what gets built next.</SectionEnd>
          </div>
        </section>

        {/* ------------------------------------------------------- closing */}
        <section data-section="closing" className="below-fold relative overflow-hidden border-t border-line">
          <div aria-hidden className="scope-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent_35%,black)]" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-full bg-[radial-gradient(60%_80%_at_50%_100%,rgb(34_227_239/0.12),transparent)]" />
          <ClosingTrace />
          <div className={cn(wrap, "relative py-28 sm:py-36")}>
            <h2 className="type-h2 max-w-4xl">Want to see inside your boat?</h2>
            <p className="type-lead mt-6 max-w-[52ch] text-muted-foreground">
              We&rsquo;re choosing beta crews now. Tell us about your boat. It takes two minutes and commits you to nothing.
            </p>
            <div className="mt-10">
              <BetaLink from="closing" className="h-14 px-7 text-base max-sm:w-full" />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <Reveals />
    </>
  );
}
