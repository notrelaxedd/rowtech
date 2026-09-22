import { measureStroke, strokeForce, toPath } from "@/lib/stroke";
import { InView } from "./in-view";

// One stroke, page-wide, drawn in behind the closing call to action.
const W = 1400;
const H = 420;
// Starts in the recovery so the drive rises to the right of the headline.
const T0 = measureStroke().catchT - 0.55;
const T1 = T0 + 1.25;

function path() {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 400; i++) {
    const t = T0 + ((T1 - T0) * i) / 400;
    const f = t < 0 ? 0 : strokeForce(t);
    pts.push([(i / 400) * W, H - 30 - (f / 66) * (H - 80)]);
  }
  return toPath(pts, 0.6);
}

export function ClosingTrace() {
  const d = path();
  return (
    <InView className="pointer-events-none absolute inset-x-0 bottom-0 h-[85%]">
      <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id="closing-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--trace)" stopOpacity="0.14" />
            <stop offset="1" stopColor="var(--trace)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d}L${W} ${H}L0 ${H}Z`} fill="url(#closing-fill)" className="rise" style={{ "--i": 8 } as React.CSSProperties} />
        <path d={d} pathLength={1} fill="none" stroke="var(--trace)" strokeOpacity={0.55} strokeWidth={2} className="draw" />
      </svg>
    </InView>
  );
}
