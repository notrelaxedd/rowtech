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
- **Offscreen work.** Sections below the hero used `content-visibility: auto`
  with a 900 px placeholder height. Since removed: until a section had been
  drawn the browser scrolled by the placeholder heights, so links such as
  `/#faq` landed hundreds of pixels away from their section (UX-001).
- **Images.** AVIF, then WebP.

## Final (after every step of the revamp)

Measured back to back with an almost-empty page on the same machine in the
same session, because this workstation's Lighthouse numbers drift: one of the
three runs below reported TBT 2,693 ms with nothing changed, so read these as
a range, not a figure.

The marketing page:

| run | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | Speed Index | Page weight |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 68 | 97 | 96 | 100 | 0.95 s | 4.22 s | 584 ms | 0 | 4.82 s | 403 kB |
| 2 | 64 | 97 | 96 | 100 | 1.54 s | 2.84 s | 2,693 ms | 0 | 4.28 s | 404 kB |
| 3 | 66 | 97 | 96 | 100 | 1.12 s | 3.84 s | 1,046 ms | 0 | 2.63 s | 402 kB |

The floor on the same machine, minutes later (`/app/login`: a heading, two
form fields and a link):

| run | Perf | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|
| 1 | 86 | 0.87 s | 3.31 s | 293 ms | 0 |
| 2 | 79 | 1.08 s | 3.12 s | 581 ms | 0 |
| 3 | 91 | 0.83 s | 3.17 s | 175 ms | 0 |

So the whole marketing page costs roughly **0.7 s of LCP and 300–500 ms of
TBT above an almost-empty page on this stack**, and CLS stays at 0 everywhere.

Against the baseline: LCP 8.4–10.3 s → 2.8–4.2 s, TBT 3.9–6.6 s → 0.6–1.0 s,
page weight 667 kB → 403 kB, HTML 336 kB → 235 kB.

### Against the brief's targets

| Target | Where it ended up |
|---|---|
| LCP < 1.5 s | Not met as measured here, but the floor on this machine is 3.1 s. Needs PageSpeed Insights against a Vercel preview to judge. |
| CLS 0 | Met, every run, including the island swaps and both sticky CTAs. |
| TBT < 100 ms | Not met as measured here (floor 175–581 ms). The page's own share is 300–500 ms. |
| JS < 120 kB gz | Not achievable: React + App Router alone is ~150 kB. Page-owned initial JS is **~15 kB** (a 10.5 kB page chunk and the 4.4 kB analytics wrapper). |

Initial JS: **168 kB**, against a 163 kB floor. `posthog-js` (only with a key),
`maplibre-gl`, the live screen engine, the stroke engine and every island are
separate chunks, none of them in the first load.

## After the device drawings (Force and Vieve, drawn in code)

The product images became SVG drawn by the site rather than WebP and PNG
files: the node, Vieve, both screens and the mounting schematic. That trades
image requests for markup, so it has to be watched.

| | Before the drawings | After |
|---|---|---|
| HTML | 235 kB | 268 kB |
| Page weight | 403 kB | 390 kB |
| Images requested | 7 (≈150 kB) | 0 |
| DOM elements | 850 | ~1,000 |
| TBT | 0.6–1.0 s | 1.2–1.5 s |
| CLS | 0 | 0 |
| Accessibility | 97 | **100** |

The machine drifted slower across this session -- the same near-empty floor
page measured TBT 175–581 ms earlier and 454–786 ms at the end -- so read the
TBT rows as "roughly 0.5 s above the floor, both times", not as a clean
before/after.

What keeps it in hand:

- The hero's node is server-rendered inline, because it is the page's anchor
  and the thing the LCP sits next to. Its screen is animated by id from a
  ~1 kB client module, not by owning the SVG in React.
- The two below-fold drawings (the node in "Three keys", Vieve in its own
  section) are islands: the server sends a placeholder holding their exact
  box, and the drawing loads when the section nears the viewport. CLS stays 0.
- Accessibility went up: each device is one labelled image describing what is
  on its screen, and two long-standing contrast failures in the stroke widget
  were fixed (dimming a block with `opacity` had taken its labels to 2.27:1).

## Re-running these

```bash
npm run build && npx next start -p 3100
# then, three runs, median of what you care about:
npx lighthouse http://localhost:3100/ --preset=desktop   # or mobile, the default
```

The scripts used here live in the scratchpad, not the repo: they are three
lines of `lighthouse --output=json` plus `gzip -9` over the page's module
scripts.

