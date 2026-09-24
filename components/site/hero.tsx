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
      <div className="mx-auto w-full max-w-7xl px-5 pt-10 sm:px-8 sm:pt-14 lg:pt-12">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
          <div>
            <h1 className="type-h1 max-w-[14ch]">The force curve from every seat, stroke by stroke.</h1>
            <p className="type-lead mt-6 max-w-[36rem] text-muted-foreground">
              A Force node on each seat&rsquo;s rigger backstay records the force curve of every stroke, shows it to the
              rower live on its 3.5&Prime; screen, and saves the session to a microSD card for you to download at the dock.
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
            <figcaption className="mt-4 text-center text-sm text-muted-foreground">Force node, concept design.</figcaption>
          </figure>
        </div>
      </div>

      {/* The curve runs the full width of the screen, edge to edge. */}
      <div className="mt-10 pb-10 sm:mt-12 sm:pb-14">
        <ScopeStrip />
      </div>
      <ScreenAnimator target="hero" />
    </section>
  );
}
