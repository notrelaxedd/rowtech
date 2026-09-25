import { EXAMPLE, measureStroke, strokeForce, toPath } from "@/lib/stroke";

// The LIVE screen's graph, as the firmware draws it, at the width of the page:
// one stroke per sweep. The trace starts at the catch, the width is the last
// catch-to-catch period plus 10%, and the next catch wipes it -- at ~91% of
// the way across. This is the page's one moment of motion; with reduced
// motion it holds the finished stroke.
const W = 1200;
const H = 240;
const KG_TOP = 70; // the scale the drawing is fitted to
const PAD_T = 18;
const PAD_B = 14;
const PERIOD_S = 60 / EXAMPLE.spm;
const WIN_S = PERIOD_S * 1.1;
const M = measureStroke();
const CATCH_S = M.catchT; // threshold crossing after onset
const END_PCT = (PERIOD_S / WIN_S) * 100; // where the next catch lands
const KG_TICKS = [0, 20, 40, 60];

const y = (kg: number) => H - PAD_B - (kg / KG_TOP) * (H - PAD_T - PAD_B);

function tracePath() {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 600; i++) {
    const t = (i / 600) * WIN_S;
    pts.push([(t / WIN_S) * W, y(strokeForce(CATCH_S + t))]);
  }
  return toPath(pts, 0.9);
}

export function ScopeStrip() {
  const d = tracePath();
  const vars = {
    "--sweep-dur": `${PERIOD_S.toFixed(3)}s`,
    "--sweep-end": `${END_PCT.toFixed(2)}%`,
  } as React.CSSProperties;
  return (
    <figure className="m-0" style={vars}>
      <div className="relative h-48 sm:h-64 lg:h-72">
        {/* the kg grid, fixed; only the trace sweeps */}
        <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {KG_TICKS.map((kg) => (
            <line
              key={kg}
              x1={0}
              x2={W}
              y1={y(kg)}
              y2={y(kg)}
              stroke={kg === 0 ? "rgb(230 235 237 / 0.28)" : "rgb(230 235 237 / 0.09)"}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="relative mx-auto h-full max-w-7xl px-5 sm:px-8">
            {KG_TICKS.map((kg) => (
              <span
                key={kg}
                className="absolute right-5 -translate-y-full pb-1 text-xs tabular-nums text-muted-foreground sm:right-8"
                style={{ top: `${(y(kg) / H) * 100}%` }}
              >
                {kg === 60 ? "60 kg" : kg}
              </span>
            ))}
          </div>
        </div>
        {/* The reveal is a window sliding right while the curve inside it
            slides back just as far, so the curve holds still: both are
            transforms, which the browser runs without repainting. */}
        <div className="rt-stroke-reveal absolute inset-0 overflow-hidden">
          <svg
            role="img"
            aria-label={`Example force curve of one stroke: ${EXAMPLE.peakKg.toFixed(1)} kg peak at ${EXAMPLE.spm} strokes a minute, drawn left to right the way the node's live screen draws it.`}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="rt-stroke-hold absolute inset-0 h-full w-full"
          >
            <path d={`${d}L${W} ${y(0)}L0 ${y(0)}Z`} fill="var(--trace)" fillOpacity={0.1} />
            <path d={d} fill="none" stroke="var(--trace)" strokeWidth={3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
        {/* The cursor is the left edge of a full-width box, so it can travel
            in percentages of the strip. */}
        <div aria-hidden className="rt-stroke-cursor pointer-events-none absolute inset-0 border-l border-trace" />
      </div>
      <figcaption className="mx-auto mt-3 flex max-w-7xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 text-sm text-muted-foreground sm:px-8">
        <span className="max-w-[62ch]">
          Example stroke, drawn the way the node&rsquo;s live screen draws it, in kilograms as a calibrated node will read.
        </span>
        <span className="tabular-nums">
          <span className="font-semibold text-foreground">{EXAMPLE.peakKg.toFixed(1)} kg</span> peak,{" "}
          <span className="font-semibold text-foreground">{EXAMPLE.spm}</span> strokes a minute
        </span>
      </figcaption>
    </figure>
  );
}
