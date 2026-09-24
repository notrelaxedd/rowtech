import type { Metadata } from "next";
import Image from "next/image";
import boardTop from "@/assets/photos/pcb-top.png";
import boardBottom from "@/assets/photos/pcb-bottom.png";
import { SitePage } from "@/components/site/site-page";
import { BetaLink } from "@/components/site/cta";
import { DeviceDiagram3D } from "@/components/site/device-diagram-3d";
import { VIEVE_DEFAULT_VIEW, VIEVE_NOTES } from "@/components/site/device-notes";
import { DevicePlaceholder } from "@/components/device/device-placeholder";
import { CoxBoxView } from "@/components/site/cox-box-view";
import { Status } from "@/components/site/status";
import { SpecTable } from "@/components/site/spec-table";
import { VIEVE_SPECS } from "@/lib/specs";

export const metadata: Metadata = {
  title: "Vieve, the RowTech cox box",
  description:
    "Vieve, the RowTech cox box, is in development: the cox's voice to the boat's speakers, and the hub every seat node reports to. Specifications and parts.",
  alternates: { canonical: "/vieve" },
};

const wrap = "mx-auto w-full max-w-7xl px-5 sm:px-8";

const BOARD = [
  { side: "top", src: boardTop },
  { side: "bottom", src: boardBottom },
] as const;

export default function VievePage() {
  return (
    <SitePage>
      <section className="py-20 sm:py-28">
        <div className={wrap}>
          <Status>In development</Status>
          <h1 className="type-h1 mt-5 max-w-[16ch]">Vieve, the RowTech cox box.</h1>
          <p className="type-lead mt-6 max-w-[40rem] text-muted-foreground">
            Vieve will carry the cox&rsquo;s voice to the boat&rsquo;s speakers and be the hub every seat node reports to.
            The target price is $499.
          </p>
        </div>
      </section>

      <section id="clock" className="border-t border-line py-24 sm:py-28">
        <div className={wrap}>
          <div className="max-w-3xl">
            <h2 className="type-h2">One clock for the whole crew.</h2>
            <p className="type-lead mt-5 text-muted-foreground">
              Seat nodes have no clock of their own. Vieve puts every seat on one, so catch timing can be compared seat to
              seat.
            </p>
          </div>
          <div className="mt-12">
            <CoxBoxView lit={8} />
          </div>
        </div>
      </section>

      <section id="parts" className="border-t border-line py-24 sm:py-28">
        <div className={wrap}>
          <h2 className="type-h2 max-w-3xl">What&rsquo;s on it, and in it.</h2>
          <div className="mt-12">
            <DeviceDiagram3D
              kind="vieve"
              label="Parts of Vieve"
              notes={VIEVE_NOTES}
              defaultView={VIEVE_DEFAULT_VIEW}
              caption="Vieve V1, concept design."
              poster={
                <div className="flex h-full items-center justify-center p-6">
                  <DevicePlaceholder ratio={1320 / 760} name="VIEVE" />
                </div>
              }
            />
          </div>
        </div>
      </section>

      <section id="specs" className="border-t border-line py-24 sm:py-28">
        <div className={wrap}>
          {/* The board layouts sit under the heading beside the table on wide
              screens. They come after the table in the source, so on a phone the
              specifications aren't pushed down the page. */}
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-10">
            <h2 className="type-h2 lg:col-start-1 lg:row-start-1">Specifications.</h2>
            <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <SpecTable specs={VIEVE_SPECS} note="In development. The case is a concept design." />
            </div>
            <div className="grid grid-cols-1 content-start gap-6 sm:grid-cols-2 lg:col-start-1 lg:row-start-2 lg:grid-cols-1">
              {BOARD.map((b) => (
                <figure key={b.side} className="m-0">
                  <Image
                    src={b.src}
                    alt={`The Vieve circuit board layout, ${b.side} side, with its components and their reference labels.`}
                    placeholder="blur"
                    sizes="(min-width: 1024px) 384px, (min-width: 640px) 45vw, 100vw"
                    className="h-auto w-full rounded-md"
                  />
                  <figcaption className="mt-2 text-sm text-muted-foreground">Circuit board layout, {b.side} side.</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line py-20 sm:py-24">
        <div className={wrap}>
          <h2 className="type-h2 max-w-[18ch]">Beta crews get a direct line to the people building Vieve.</h2>
          <div className="mt-8">
            <BetaLink from="vieve" className="h-14 px-7 text-base max-sm:w-full" />
          </div>
        </div>
      </section>
    </SitePage>
  );
}
