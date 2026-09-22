import Image from "next/image";
import Link from "next/link";
import { BetaLink, ctaSecondary } from "./cta";
import { HeroScreen } from "./hero-screen";
import { cn } from "@/lib/utils";

// Server-rendered. The only client code is the running screen, which loads
// after the page does and lays itself over the still render's screen.
export function Hero() {
  const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

  return (
    <section className="relative overflow-hidden">
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
            RowTech puts a force sensor on the rigger of every seat in the boat. Each node records the force curve of
            every stroke, shows it live on the seat, and hands the whole session to the coach when the boat comes in.
          </p>
          <div className="rt-rise mt-8 flex flex-wrap gap-3" style={d(520)}>
            <BetaLink from="hero" className="max-sm:w-full" />
            <Link href="#how" className={cn(ctaSecondary, "max-sm:w-full")}>
              See how it works
            </Link>
          </div>
          <p className="rt-rise mt-5 text-sm text-muted-foreground" style={d(600)}>
            For coaches, clubs and programs. Applying takes two minutes and commits you to nothing.
          </p>
        </div>

        <div className="[perspective:1800px]">
          <div className="relative [transform:rotateY(-14deg)_rotateX(5deg)] drop-shadow-[0_40px_60px_rgb(0_0_0/0.6)] max-lg:[transform:rotateY(-8deg)_rotateX(3deg)]">
            <Image
              src="/product/device-front.webp"
              alt="The RowTech node: a matte black enclosure with a 3.5-inch screen showing a live force reading over the graph of the stroke in progress, and three buttons down its right edge."
              width={1360}
              height={794}
              preload
              fetchPriority="high"
              sizes="(min-width: 1280px) 720px, (min-width: 1024px) 56vw, 100vw"
              className="block h-auto w-full"
            />
            <HeroScreen />
          </div>
        </div>
      </div>
    </section>
  );
}
