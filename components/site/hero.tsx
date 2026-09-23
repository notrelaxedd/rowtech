import Link from "next/link";
import { BetaLink, ctaSecondary } from "./cta";
import { ForceDevice } from "@/components/device/force-device";
import { ScreenAnimator } from "@/components/device/screen-animator";
import { cn } from "@/lib/utils";

// Server-rendered, including the node and its screen. The only client code is
// the animator, which runs the screen the server already drew.
export function Hero() {
  const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

  return (
    <section data-section="hero" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-10%] h-[42rem] w-[60rem] rounded-full bg-[radial-gradient(closest-side,rgb(34_227_239/0.14),transparent)]"
      />
      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-5 pt-12 pb-16 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:gap-6 lg:pt-20 lg:pb-24">
        <div>
          <p className="rt-rise readout inline-flex items-center gap-2.5 text-sm text-muted-foreground">
            <span aria-hidden className="rt-blink size-2 rounded-full bg-ok shadow-[0_0_10px_rgb(61_220_110/0.7)]" />
            <span>
              <span className="text-ok">REC</span> · beta, recruiting crews now
            </span>
          </p>
          <h1 className="type-h1 mt-5">
            <span className="rt-rise block" style={d(80)}>Every seat.</span>
            <span className="rt-rise block" style={d(180)}>Every stroke.</span>
            <span className="rt-rise block text-trace" style={d(280)}>Measured.</span>
          </h1>
          <p className="rt-rise type-lead mt-6 max-w-[34rem] text-muted-foreground" style={d(420)}>
            See who&rsquo;s carrying the boat, stroke by stroke. A Force node on every seat&rsquo;s rigger records each
            stroke&rsquo;s force curve, shows it live on the seat, and hands you the whole session when the boat comes in.
          </p>
          <div className="rt-rise mt-8 flex flex-wrap gap-3" style={d(520)}>
            <BetaLink from="hero" className="max-sm:w-full" />
            <Link href="/demo?from=hero" data-cta="hero-demo" className={cn(ctaSecondary, "max-sm:w-full")}>
              See what a session looks like
            </Link>
          </div>
          <p className="rt-rise mt-5 text-sm text-muted-foreground" style={d(600)}>
            For coaches, clubs and programs. We&rsquo;re choosing beta crews now: two minutes to apply, no commitment.
          </p>
        </div>

        <div className="[perspective:2000px]">
          <figure className="relative m-0 [transform:rotateY(-13deg)_rotateX(5deg)] drop-shadow-[0_40px_60px_rgb(0_0_0/0.6)] max-lg:[transform:rotateY(-7deg)_rotateX(3deg)]">
            <ForceDevice idPrefix="hero" className="block h-auto w-full" />
          </figure>
        </div>
      </div>
      <ScreenAnimator target="hero" />
    </section>
  );
}
