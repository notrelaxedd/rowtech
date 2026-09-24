import { EXAMPLE, driveShape, toPath } from "@/lib/stroke";

// Illustration of the crew view in development: eight seats, one stroke, drawn
// as a ridgeline from the catch to the peak. Each ridge rises into the lane
// above and hides what is behind it, so catch timing reads as the offset of
// each ridge's leading edge.
const SEATS = [
  { seat: 8, name: "stroke", off: 0, k: 1.0 },
  { seat: 7, name: "", off: 6, k: 0.95 },
  { seat: 6, name: "", off: -4, k: 1.04 },
  { seat: 5, name: "", off: 11, k: 0.9 },
  { seat: 4, name: "", off: 3, k: 0.98 },
  { seat: 3, name: "", off: -2, k: 1.02 },
  { seat: 2, name: "", off: 9, k: 0.93 },
  { seat: 1, name: "bow", off: -9, k: 0.96 },
];
const MEAN = SEATS.reduce((a, s) => a + s.off, 0) / SEATS.length;
const SPREAD = Math.max(...SEATS.map((s) => s.off)) - Math.min(...SEATS.map((s) => s.off));

const W = 720;
const X0 = 92;
const X1 = W - 84;
const LANE = 38;
const GAIN = (LANE * 1.5) / EXAMPLE.peakKg; // px per kg
const TOP = 36 + LANE * 0.55; // room for the first ridge to rise
const H = TOP + LANE * SEATS.length + 6;
const T0 = -0.06;
const T1 = 0.42;
const TICKS = [0, 0.1, 0.2, 0.3, 0.4];
const PULSE = 0.924;

const x = (t: number) => X0 + ((t - T0) / (T1 - T0)) * (X1 - X0);
const base = (i: number) => TOP + (i + 1) * LANE - 8;

function ridge(off: number, k: number, y0: number) {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 200; i++) {
    const t = T0 + ((T1 - T0) * i) / 200;
    const f = EXAMPLE.peakKg * k * driveShape((t - off / 1000) / PULSE);
    pts.push([x(t), y0 - f * GAIN]);
  }
  const line = toPath(pts, 0.5);
  return { line, fill: `${line}L${X1} ${y0}L${X0} ${y0}Z` };
}

export function CrewLanes() {
  const late = SEATS.reduce((a, s) => (s.off > a.off ? s : a));
  const early = SEATS.reduce((a, s) => (s.off < a.off ? s : a));
  const ms = (v: number) => Math.abs(Math.round(v - MEAN));
  return (
    <figure className="m-0">
      <div role="region" className="instrument overflow-x-auto rounded-lg" tabIndex={0} aria-label="Crew view illustration, scrolls sideways on narrow screens">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Illustration: force from the catch to the peak for eight seats. Catch spread ${SPREAD} milliseconds. Seat ${late.seat} is latest, ${ms(late.off)} ms after the crew average; seat ${early.seat} is earliest, ${ms(early.off)} ms before it.`}
          className="block h-auto w-full min-w-[34rem]"
        >
          {TICKS.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={28} y2={H - 6} stroke="rgb(255 255 255 / 0.05)" />
              <text x={x(t)} y={20} textAnchor="middle" className="fill-muted-foreground text-[12px] tabular-nums">
                {t === 0 ? "catch" : `+${Math.round(t * 1000)} ms`}
              </text>
            </g>
          ))}

          {SEATS.map((s, i) => {
            const y0 = base(i);
            const r = ridge(s.off, s.k, y0);
            return (
              <g key={s.seat}>
                <line x1={X0} x2={X1} y1={y0} y2={y0} stroke="rgb(255 255 255 / 0.1)" />
                <g>
                  <path d={r.fill} fill="var(--panel)" />
                  <path d={r.line} fill="none" stroke="var(--trace)" strokeWidth={1.6} strokeLinejoin="round" />
                </g>
              </g>
            );
          })}

          <line
            x1={x(MEAN / 1000)}
            x2={x(MEAN / 1000)}
            y1={28}
            y2={H - 6}
            stroke="white"
            strokeOpacity={0.4}
            strokeDasharray="2 4"
          />

          {SEATS.map((s, i) => {
            const y0 = base(i);
            const rel = s.off - MEAN;
            const far = Math.abs(rel) > 7;
            return (
              <g key={s.seat}>
                <g>
                  <circle
                    cx={x(s.off / 1000)}
                    cy={y0}
                    r={far ? 3.5 : 2.5}
                    fill={far ? "var(--warn)" : "white"}
                    fillOpacity={far ? 1 : 0.7}
                  />
                </g>
                <text x={14} y={y0 - 3} className="fill-foreground text-[13px] font-semibold">
                  {s.seat}
                  <tspan className="fill-muted-foreground font-normal"> {s.name}</tspan>
                </text>
                <text x={W - 14} y={y0 - 3} textAnchor="end" className={`text-[13px] tabular-nums ${far ? "fill-warn" : "fill-muted-foreground"}`}>
                  {rel >= 0 ? "+" : "−"}
                  {Math.abs(Math.round(rel))} ms
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="mt-3 max-w-[70ch] text-sm text-muted-foreground">
        <span className="sm:hidden">Swipe the chart sideways to see every seat&rsquo;s offset. </span>
        Illustration of the crew view. Each ridge is one seat from catch to peak; dots mark each catch, yellow when more
        than 7 ms off the crew average (dotted line). Catch spread here: {SPREAD} ms.
      </figcaption>
    </figure>
  );
}
