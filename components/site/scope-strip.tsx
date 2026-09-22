import { EXAMPLE, measureStroke, strokeForce, toPath } from "@/lib/stroke";

// The LIVE screen's graph, as the firmware draws it: one stroke per sweep.
// The trace starts at the catch, the width is the last catch-to-catch period
// plus 10%, and the next catch wipes it -- at ~91% of the way across.
const W = 1200;
const H = 160;
const PERIOD_S = 60 / EXAMPLE.spm;
const WIN_S = PERIOD_S * 1.1;
const CATCH_S = measureStroke().catchT;       // threshold crossing after onset
const END_PCT = (PERIOD_S / WIN_S) * 100;     // where the next catch lands

function tracePath() {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 600; i++) {
    const t = (i / 600) * WIN_S;
    pts.push([(t / WIN_S) * W, H - 12 - (strokeForce(CATCH_S + t) / 70) * (H - 24)]);
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
    <div className="border-y border-line bg-[#05070a]" style={vars}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="readout flex items-center justify-between gap-4 py-3 text-xs text-muted-foreground">
          <span>
            <span className="text-trace">LIVE</span>
            <span aria-hidden> · </span>seat 5 · kg
          </span>
          <span>
            <span className="hidden sm:inline">one stroke per sweep · </span>
            {EXAMPLE.spm} spm
          </span>
        </div>
        <div aria-hidden className="scope-grid relative h-28 border-t border-line sm:h-36">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="rt-stroke-reveal absolute inset-0 h-full w-full"
          >
            <path
              d={d}
              fill="none"
              stroke="var(--trace)"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="rt-stroke-cursor absolute inset-y-0 w-px bg-trace/80 shadow-[0_0_14px_2px_rgb(34_227_239/0.45)]" />
        </div>
      </div>
    </div>
  );
}
