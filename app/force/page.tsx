import type { Metadata } from "next";
import { SitePage, wrap } from "@/components/site/site-page";
import { BetaLink } from "@/components/site/cta";
import { DeviceDiagram3D } from "@/components/site/device-diagram-3d";
import { FORCE_DEFAULT_VIEW, FORCE_NOTES } from "@/components/site/device-notes";
import { ForceDevice } from "@/components/device/force-device";
import { SpecTable } from "@/components/site/spec-table";
import { FORCE_SPECS } from "@/lib/specs";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Force, the seat node",
  description:
    "Seat-by-seat rowing force measurement: a Force node on each seat's rigger backstay records the force curve of every stroke and shows it to the rower live.",
  path: "/force",
});

const BOATHOUSE = [
  {
    t: "Its own Wi-Fi network",
    d: "Each node runs its own network. Join it from a phone, open a browser, and the node’s page is there. There’s no app to install.",
  },
  {
    t: "Calibration, and where it stands",
    d: "The firmware calibrates against up to five known weights and reports its own worst-case error. We haven’t calibrated a node yet, so for now force reads in raw sensor units. The timing measures don’t need calibration.",
  },
] as const;

// No Product structured data: Google only uses it with an offer, a review or
// a rating, and Force isn't on sale. Add it with a real offer when it is.
export default function ForcePage() {
  return (
    <SitePage>
      <section className="py-20 sm:py-28">
        <div className={wrap}>
          <h1 className="type-h1 max-w-[16ch]">Force, the seat node.</h1>
          <p className="type-lead mt-6 max-w-[40rem] text-muted-foreground">
            Seat-by-seat rowing force measurement: one node on each seat&rsquo;s rigger backstay. It records the force
            curve of every stroke, shows the rower their own peak and curve live, and saves the practice for you to
            download at the dock.
          </p>
        </div>
      </section>

      <section id="parts" className="border-t border-line py-24 sm:py-28">
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
              caption="Force node, concept design, wired to a 50 kg load cell in series on the rigger backstay. Its screen shows example data, and the Vieve link as designed."
              poster={
                <div className="flex h-full items-center justify-center p-6">
                  <ForceDevice idPrefix="poster" className="block h-auto w-full" />
                </div>
              }
            />
          </div>
        </div>
      </section>

      <section id="boathouse" className="border-t border-line py-24 sm:py-28">
        <div className={wrap}>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
            <h2 className="type-h2">It brings its own network to the dock.</h2>
            <dl className="grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2">
              {BOATHOUSE.map((f) => (
                <div key={f.t}>
                  <dt className="type-h3">{f.t}</dt>
                  <dd className="type-body mt-2 text-muted-foreground">{f.d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section id="specs" className="border-t border-line py-24 sm:py-28">
        <div className={wrap}>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
            <h2 className="type-h2">Specifications.</h2>
            <SpecTable specs={FORCE_SPECS} note="The case is a concept design." />
          </div>
        </div>
      </section>

      <section className="border-t border-line py-20 sm:py-24">
        <div className={wrap}>
          <h2 className="type-h2 max-w-[18ch]">Try Force in the beta.</h2>
          <div className="mt-8">
            <BetaLink from="force" className="h-14 px-7 text-base max-sm:w-full" />
          </div>
        </div>
      </section>
    </SitePage>
  );
}
