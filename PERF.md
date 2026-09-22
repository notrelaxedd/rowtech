# Performance

Targets from the revamp brief: LCP < 1.5 s on mobile, CLS 0, TBT < 100 ms, JS
shipped to the marketing page < 120 kB gzipped.

## How it's measured

- `next build && next start`, then Lighthouse 12, mobile preset (simulated
  throttling: slow 4G, 4x CPU), headless Chrome. Three runs per state, all
  reported.
- "Initial JS" means every `<script type=module>` chunk referenced by the
  page's HTML, each compressed with `gzip -9`. The core-js polyfill chunk is
  left out because Next marks it `noModule`, so modern browsers never fetch it.
  Chunks loaded later (islands, the hero screen) are listed separately.

### The machine matters: read the floor first

This was measured on a Windows 11 workstation. Headless Chrome there holds
first paint for about 2.4 s whatever the page is. Lighthouse's simulation
then charges every task that ran before that late paint to LCP and TBT. A
near-empty page (`/beta/thanks`: a heading, a paragraph and a link) scores
**LCP 3.4 s, TBT 331 ms** on this machine. Read every result below against
that floor, not against zero.

**To get numbers comparable with the targets, run PageSpeed Insights (Linux
Lighthouse) against a Vercel preview deploy.** Nothing has been deployed as
part of this work.

### The JS budget is below the framework floor

Next 16 App Router with React 19 ships about **150 kB gzipped before any page
code**: react-dom (~71 kB), the App Router runtime (~75 kB) and Vercel
Analytics/Speed Insights (~4 kB). The 120 kB target can't be met on this
stack without leaving the App Router. The budget we actually hold ourselves
to is **page-owned initial JS**: everything above that floor.

## Baseline (dfd3d20, before the revamp)

| run | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | Speed Index | Page weight |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 40 | 97 | 96 | 100 | 1.27 s | 8.98 s | 4,588 ms | 0 | 5.67 s | 668 kB |
| 2 | 41 | 97 | 96 | 100 | 1.19 s | 8.42 s | 3,918 ms | 0 | 5.66 s | 667 kB |
| 3 | 36 | 97 | 96 | 100 | 2.38 s | 10.34 s | 6,572 ms | 0 | 6.44 s | 666 kB |

Initial JS: **221 kB** (includes the 39 kB `noModule` polyfill chunk the
method above now excludes, so about 182 kB like-for-like). The three.js hero
(an 680 kB chunk, loaded right after hydration) ran a WebGL render loop every
frame. That loop was most of the 4–6 s TBT and kept the LCP image from
rendering for about 7.8 s. HTML was 336 kB: every SVG curve was sampled at
full resolution and then serialized a second time in the RSC payload.

## After the performance pass

| run | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | Speed Index | Page weight |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 76 | 97 | 96 | 100 | 0.96 s | 3.90 s | 367 ms | 0 | 4.65 s | 371 kB |
| 2 | 68 | 97 | 96 | 100 | 0.95 s | 4.01 s | 634 ms | 0 | 4.67 s | 372 kB |
| 3 | 76 | 97 | 96 | 100 | 0.95 s | 3.88 s | 389 ms | 0 | 4.61 s | 371 kB |

Initial JS: **166 kB**, of which about 16 kB is page-owned. HTML: **177 kB**.

What changed:

- **Hero.** The WebGL scene, three.js and the GLB are gone. The hero is a
  server component. The LCP is the still render (`device-front.webp`, with
  `preload` and `fetchPriority="high"`; Next 16 deprecates `priority`). The
  node's real LIVE screen engine (`lib/live-screen.ts`) loads after `load` +
  idle and runs on a canvas laid over the render's screen, fitted to the
  pixel. The 260vh scroll pin went with the scene, since the brief rules out
  scroll-jacking.
- **Islands.** The stroke widget, screen tour and cox box diagram ship as
  server-rendered static views. Each interactive version is its own chunk,
  fetched when the block comes within 400 px of the viewport or is pointed
  at or focused (`components/site/islands.tsx`). The widget's live engine is
  a further `next/dynamic` chunk, fetched only on "Row it yourself". Static
  and interactive versions render the same view component, so the swap
  can't shift anything.
- **Reveals.** One observer for the whole page (`reveals.tsx`) replaces a
  client wrapper per block. `InView` is now a server component that only
  marks the element.
- **SVG weight.** Static curves go through Ramer–Douglas–Peucker
  simplification at a quarter-pixel tolerance before they are serialized.
- **Offscreen work.** Sections below the hero use `content-visibility: auto`
  with a remembered intrinsic size. The first layout covers only what is on
  screen, and scrollbar and anchor jumps stay stable.
- **Images.** AVIF, then WebP.

## Final (after every step of the revamp)

_Filled in after the last commit._
