import Image from "next/image";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { BetaLink } from "@/components/site/cta";
import { Hero } from "@/components/site/hero";
import { InView } from "@/components/site/in-view";
import { ScopeStrip } from "@/components/site/scope-strip";
import { CrewLanes } from "@/components/site/crew-lanes";
import { CurveExplorer } from "@/components/site/curve-explorer";
import { ScreenTour } from "@/components/site/screen-tour";
import { CoxBoxDiagram } from "@/components/site/cox-box-diagram";
import { SessionFiles } from "@/components/site/session-files";
import { ClosingTrace } from "@/components/site/closing-trace";
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

const TODAY = [
  "A force curve for every stroke, on every seat",
  "Rate, drive and recovery times, and rhythm",
  "Peak force and where it lands, rise rate, work by thirds",
  "Stroke-to-stroke consistency",
  "Sessions saved automatically, downloadable as files",
  "30-second capture that keeps what happened before the trigger",
  "Set-up from a phone, over the node's own WiFi",
];
const NEXT = [
  "The RowTech cox box: the cox's voice, GPS, and the hub for every seat",
  "One clock across the boat, within 5 ms for eight seats",
  "Catch spread and sequencing",
  "Impulse matching and port-starboard balance",
  "Upload to a shared team dashboard",
];

const FAQ = [
  {
    q: "Do we need WiFi at the boathouse?",
    a: "No. Every node runs its own network. Join it from a phone or laptop and open a browser: there's nothing to install and nothing to sign in to.",
  },
  {
    q: "Does it replace our cox box?",
    a: "Today the seat nodes work alongside whatever you already use. We're building our own cox box that carries the cox's voice and ties every seat together, and it's coming next.",
  },
  {
    q: "Which boats and riggers does it fit?",
    a: "The sensor mounts on the rigger backstay. Tell us what you row when you apply and we'll talk through fitting it to your boat.",
  },
  {
    q: "Where does the data go?",
    a: "Onto each node's SD card, and off it as plain files over the node's own WiFi. A shared team dashboard is on the way.",
  },
  {
    q: "How accurate is the force reading?",
    a: "Each node is calibrated against known weights with a fit of up to five points, and reports its own worst-case error. Rate, rhythm and catch timing are measured to within a few milliseconds.",
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
        <section id="crew" className="py-24 sm:py-32">
          <div className={cn(wrap, "grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-16")}>
            <div>
              <Coming>Coming with the RowTech cox box</Coming>
              <h2 className="type-h2 mt-6">See who&rsquo;s early. See who&rsquo;s carrying the boat.</h2>
              <p className="type-body mt-6 max-w-[58ch] text-muted-foreground">
                A rate meter gives you the boat&rsquo;s rhythm. A node on every seat shows you each rower inside it: whose
                catch lands late, who does the work through the middle of the drive, whether stroke side and bow side are
                pulling evenly.
              </p>
              <p className="type-body mt-4 max-w-[58ch] text-muted-foreground">
                Our cox box keeps every seat on one clock, to within 5 ms across an eight, so catch timing across the whole
                crew is something you can finally measure. We&rsquo;re building it with our beta crews.
              </p>
            </div>
            <CrewLanes />
          </div>
        </section>

        {/* ---------------------------------------------------- how it works */}
        <section id="how" className="border-t border-line bg-[#0a0d10] py-24 sm:py-28">
          <div className={wrap}>
            <div className="max-w-2xl">
              <h2 className="type-h2">Fit it. Row. Review.</h2>
              <p className="type-lead mt-5 text-muted-foreground">No laptop in the launch, no app, no pairing.</p>
            </div>
            <ol className="mt-14 grid grid-cols-1 gap-14 md:grid-cols-3 md:gap-8 lg:gap-12">
              <li>
                <div className="flex h-64 items-center justify-center lg:h-72">
                  <Image src="/product/device-side.webp" alt="The node from its side, showing the port where the sensor cable enters." width={1116} height={972} sizes="(min-width: 768px) 30vw, 100vw" className="h-full w-full object-contain" />
                </div>
                <p className="readout mt-6 text-sm text-trace">1</p>
                <h3 className="type-h3 mt-2">Fit a node to each seat</h3>
                <p className="type-body mt-3 text-muted-foreground">
                  The load cell mounts on the rigger backstay and cables to the node beside it. One node for each seat you
                  want to measure, each on its own battery.
                </p>
              </li>
              <li>
                <div className="flex h-64 items-center justify-center lg:h-72">
                  <Image src="/product/device-stroke.webp" alt="The node showing its STROKE screen: 28.4 strokes a minute, drive and recovery times, peak position and the last stroke's force curve." width={1496} height={1030} sizes="(min-width: 768px) 30vw, 100vw" className="h-full w-full object-contain" />
                </div>
                <p className="readout mt-6 text-sm text-trace">2</p>
                <h3 className="type-h3 mt-2">Row</h3>
                <p className="type-body mt-3 text-muted-foreground">
                  Each node finds every catch and release by itself, shows live force on its screen, and starts recording on
                  the first stroke. Nobody has to press record.
                </p>
              </li>
              <li>
                <div className="flex h-64 items-center lg:h-72">
                  <SessionFiles />
                </div>
                <p className="readout mt-6 text-sm text-trace">3</p>
                <h3 className="type-h3 mt-2">Review</h3>
                <p className="type-body mt-3 text-muted-foreground">
                  Back at the dock, join the node&rsquo;s own WiFi from a phone or laptop and download the session: every
                  stroke, every force curve, ready to go through with the crew.
                </p>
              </li>
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------ one stroke */}
        <section id="stroke" className="py-24 sm:py-32">
          <div className={wrap}>
            <div className="max-w-3xl">
              <h2 className="type-h2">One stroke, taken apart.</h2>
              <p className="type-lead mt-5 text-muted-foreground">
                Every stroke is cut out of the signal and measured on the node itself, from 80 readings a second. Pick a
                measure to see where it comes from.
              </p>
            </div>
            <div className="mt-12">
              <CurveExplorer />
            </div>
            <p className="mt-8 text-sm text-muted-foreground">Example data.</p>
          </div>
        </section>

        {/* --------------------------------------------------------- screens */}
        <section id="screens" className="border-y border-line bg-[#0a0d10] py-24 sm:py-28">
          <div className={wrap}>
            <div className="max-w-3xl">
              <h2 className="type-h2">Three buttons. Nothing to set up afloat.</h2>
              <p className="type-lead mt-5 text-muted-foreground">
                The buttons sit down the right edge. The middle one always means NEXT, and holding it always brings you
                back to LIVE, so nobody gets lost mid-piece.
              </p>
            </div>
            <div className="mt-12">
              <ScreenTour />
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- cox box */}
        <section id="cox-box" className="py-24 sm:py-32">
          <div className={wrap}>
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16">
              <div>
                <Coming>Now in development</Coming>
                <h2 className="type-h2 mt-6">A cox box that hears every seat.</h2>
              </div>
              <p className="type-lead text-muted-foreground">
                We&rsquo;re building our own cox box. It does the job every cox relies on, and it&rsquo;s the hub every seat
                node reports to.
              </p>
            </div>
            <div className="mt-12">
              <CoxBoxDiagram />
            </div>
            <dl className="mt-14 grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="type-h3">The cox&rsquo;s voice</dt>
                <dd className="type-body mt-2 text-muted-foreground">
                  A built-in amplifier carries the cox&rsquo;s calls down the boat, like the unit you use today.
                </dd>
              </div>
              <div>
                <dt className="type-h3">One clock for the crew</dt>
                <dd className="type-body mt-2 text-muted-foreground">
                  Keeps all eight seats in time with each other to within 5 ms, which is what makes crew timing work.
                </dd>
              </div>
              <div>
                <dt className="type-h3">GPS on board</dt>
                <dd className="type-body mt-2 text-muted-foreground">
                  Stamps every session with GPS time, so outings line up across boats and days.
                </dd>
              </div>
              <div>
                <dt className="type-h3">Uploads ashore</dt>
                <dd className="type-body mt-2 text-muted-foreground">
                  Back on land, it sends the whole crew&rsquo;s session to the team dashboard over WiFi.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* ------------------------------------------------------- boathouse */}
        <section id="boathouse" className="border-t border-line bg-[#0a0d10] py-24 sm:py-28">
          <div className={cn(wrap, "grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16")}>
            <h2 className="type-h2">Made for the boathouse, not the lab.</h2>
            <dl className="grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2">
              <div>
                <dt className="type-h3">Its own network</dt>
                <dd className="type-body mt-2 text-muted-foreground">
                  Each node runs its own WiFi. Join it from a phone, open a browser, and everything is there. No app, no
                  router, no account.
                </dd>
              </div>
              <div>
                <dt className="type-h3">Switch off without worry</dt>
                <dd className="type-body mt-2 text-muted-foreground">
                  Sessions are saved as they&rsquo;re recorded, so turning the boat off at the dock never costs you the
                  practice.
                </dd>
              </div>
              <div>
                <dt className="type-h3">Lasts the outing</dt>
                <dd className="type-body mt-2 text-muted-foreground">
                  Sized for about eight hours on a charge, against a two-hour practice. Charge level sits in the corner of
                  every screen.
                </dd>
              </div>
              <div>
                <dt className="type-h3">Numbers you can trust</dt>
                <dd className="type-body mt-2 text-muted-foreground">
                  The display shows exactly the precision the sensor can resolve, and flags an overload rather than hiding
                  it.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* ----------------------------------------------- what's in the beta */}
        <section id="beta-scope" className="border-t border-line py-24 sm:py-28">
          <div className={wrap}>
            <h2 className="type-h2 max-w-3xl">What&rsquo;s in the beta.</h2>
            <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-line">
              <div className="lg:pr-12">
                <h3 className="type-h3 flex items-center gap-2.5">
                  <Lamp tone="ok" /> On every node today
                </h3>
                <InView threshold={0.15}>
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
                <InView threshold={0.15}>
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
          </div>
        </section>

        {/* ------------------------------------------------------------- FAQ */}
        <section id="faq" className="border-t border-line bg-[#0a0d10] py-24 sm:py-28">
          <div className={cn(wrap, "grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16")}>
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
        </section>

        {/* ------------------------------------------------------- closing */}
        <section className="relative overflow-hidden border-t border-line">
          <div aria-hidden className="scope-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent_35%,black)]" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-full bg-[radial-gradient(60%_80%_at_50%_100%,rgb(34_227_239/0.12),transparent)]" />
          <ClosingTrace />
          <div className={cn(wrap, "relative py-28 sm:py-36")}>
            <h2 className="type-h2 max-w-4xl">Interested? Contact us for beta testing.</h2>
            <p className="type-lead mt-6 max-w-[52ch] text-muted-foreground">
              We&rsquo;re looking for coaches, clubs and programs who want to see inside their boat, and help shape what
              RowTech becomes.
            </p>
            <div className="mt-10">
              <BetaLink from="closing" className="h-14 px-7 text-base max-sm:w-full" />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
