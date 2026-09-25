import Link from "next/link";
import { BetaLink } from "./cta";
import { ScopeStrip } from "./scope-strip";
import { ForceDevice } from "@/components/device/force-device";
import { ScreenAnimator } from "@/components/device/screen-animator";

// Server-rendered, including the node, its screen and the curve. The only
// client code is the animator, which runs the screen the server already drew.
// River water, fog-white type, and one force curve the width of the page: the
// page spends all of its boldness here.
export function Hero() {
  return (
    <section data-section="hero" className="river relative overflow-hidden">
      {/* The headline and the node fill the first screen under the header,
          centred in it on every device; the curve starts just below. */}
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-7xl flex-col justify-center px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
          <div>
            <h1 className="type-h1 max-w-[16ch]">The force curve from every seat in the boat.</h1>
            <p className="type-lead mt-6 max-w-[36rem] text-muted-foreground">
              A Force node on each seat&rsquo;s rigger backstay records the force curve of every stroke and shows it to the
              rower live. You download the practice at the dock.
            </p>
            <div className="mt-8">
              <BetaLink from="hero" className="max-sm:w-full" />
            </div>
            <p className="mt-5 text-sm text-muted-foreground">For high school, college and club coaches. We&rsquo;re choosing beta crews now.</p>
          </div>

          <figure className="m-0 [perspective:2000px] max-lg:mx-auto max-lg:max-w-md">
            <div className="[transform:rotateY(-11deg)_rotateX(4deg)] drop-shadow-[0_24px_36px_rgb(3_14_18/0.55)] max-lg:[transform:none]">
              <ForceDevice idPrefix="hero" className="block h-auto w-full" />
            </div>
            <figcaption className="mt-4 text-center text-sm text-muted-foreground">
              Force node, concept design. Its screen shows example data, and the Vieve link as designed.{" "}
              <Link href="/force" className="hit-area relative text-foreground underline underline-offset-4 hover:text-trace">
                See Force
              </Link>
            </figcaption>
          </figure>
        </div>
      </div>

      {/* The curve runs the full width of the screen, edge to edge. */}
      <div className="pb-10 sm:pb-14">
        <ScopeStrip />
      </div>
      <ScreenAnimator target="hero" />
    </section>
  );
}
