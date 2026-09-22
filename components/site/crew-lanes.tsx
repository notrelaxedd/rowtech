import { EXAMPLE, driveShape, toPath } from "@/lib/stroke";
import { InView } from "./in-view";

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
  const line = toPath(pts, 0.25);
  return { line, fill: `${line}L${X1} ${y0}L${X0} ${y0}Z` };
}

// The catch dots land in the crew's real order, bow first, spaced in
// proportion to their real timing (1 ms of catch = 30 ms of animation), once
// every ridge has risen.
const EARLIEST = Math.min(...SEATS.map((s) => s.off));
const land = (off: number) => ({ "--d": `${900 + (off - EARLIEST) * 30}ms` }) as React.CSSProperties;

export function CrewLanes() {
  const late = SEATS.reduce((a, s) => (s.off > a.off ? s : a));
  const early = SEATS.reduce((a, s) => (s.off < a.off ? s : a));
  const ms = (v: number) => Math.abs(Math.round(v - MEAN));
  return (
    <figure className="m-0">
      <InView className="overflow-x-auto rounded-lg border border-line bg-panel">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Illustration: force from the catch to the peak for eight seats. Catch spread ${SPREAD} milliseconds. Seat ${late.seat} is latest, ${ms(late.off)} ms after the crew average; seat ${early.seat} is earliest, ${ms(early.off)} ms before it.`}
          className="block h-auto w-full min-w-[34rem]"
        >
          {TICKS.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={28} y2={H - 6} stroke="rgb(255 255 255 / 0.05)" />
              <text x={x(t)} y={20} textAnchor="middle" className="fill-muted-foreground font-mono text-[11px]">
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
                {/* Rises out of its own baseline, bow first. */}
                <g className="ridge" style={{ "--i": SEATS.length - 1 - i } as React.CSSProperties}>
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
                <g style={land(s.off)}>
                  {far && <circle cx={x(s.off / 1000)} cy={y0} r={3.5} fill="none" stroke="var(--warn)" strokeWidth={1.5} className="pulse-once" />}
                  <circle
                    cx={x(s.off / 1000)}
                    cy={y0}
                    r={far ? 3.5 : 2.5}
                    fill={far ? "var(--warn)" : "white"}
                    fillOpacity={far ? 1 : 0.7}
                    className="land"
                  />
                </g>
                <text x={14} y={y0 - 3} className="fill-foreground text-[13px] font-semibold">
                  {s.seat}
                  <tspan className="fill-muted-foreground font-normal"> {s.name}</tspan>
                </text>
                <text x={W - 14} y={y0 - 3} textAnchor="end" className={`font-mono text-[12px] ${far ? "fill-warn" : "fill-muted-foreground"}`}>
                  {rel >= 0 ? "+" : "−"}
                  {Math.abs(Math.round(rel))} ms
                </text>
              </g>
            );
          })}
        </svg>
      </InView>
      <figcaption className="mt-3 text-sm text-muted-foreground">
        Illustration of the crew view. Each ridge is one seat from catch to peak; dots mark each catch, amber when more
        than 7 ms off the crew average (dotted line). Catch spread here: {SPREAD} ms.
      </figcaption>
    </figure>
  );
}
