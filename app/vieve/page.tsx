import type { Metadata } from "next";
import { SitePage, wrap } from "@/components/site/site-page";
import { BetaLink } from "@/components/site/cta";
import { DeviceDiagram3D } from "@/components/site/device-diagram-3d";
import { VIEVE_DEFAULT_VIEW, VIEVE_NOTES } from "@/components/site/device-notes";
import { VieveDevice } from "@/components/device/vieve-device";
import { CoxBoxView } from "@/components/site/cox-box-view";
import { Status } from "@/components/site/status";
import { SpecTable } from "@/components/site/spec-table";
import { VIEVE_SPECS } from "@/lib/specs";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  // The template adds the brand once.
  title: "Vieve, the cox box",
  description:
    "Vieve, the RowTech cox box, is in development: the cox's voice to the boat's speakers, and the hub every seat node reports to. Specifications and parts.",
  path: "/vieve",
});

export default function VievePage() {
  return (
    <SitePage>
      <section className="py-20 sm:py-28">
        <div className={wrap}>
          <Status>In development</Status>
          <h1 className="type-h1 mt-5 max-w-[16ch]">Vieve, the RowTech cox box.</h1>
          <p className="type-lead mt-6 max-w-[40rem] text-muted-foreground">
            Vieve will carry the cox&rsquo;s voice to the boat&rsquo;s speakers and be the hub every seat node reports to.
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
                  <VieveDevice idPrefix="poster" className="block h-auto w-full" />
                </div>
              }
            />
          </div>
        </div>
      </section>

      <section id="specs" className="border-t border-line py-24 sm:py-28">
        <div className={wrap}>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
            <h2 className="type-h2">Specifications.</h2>
            <SpecTable specs={VIEVE_SPECS} note="In development. The case is a concept design." />
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
