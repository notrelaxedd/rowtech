import { EXAMPLE, measureStroke, recentStrokes, strokeForce, toPath } from "@/lib/stroke";
import { FORCE_PANEL, SCREEN, mono, sans } from "./screen-theme";

// The Force seat node's screen, after "Vieve V1 + Force, concept A": the
// rower's own peak, huge, beside this stroke's curve against the last one.
// Every number is measured off the curve it draws (lib/stroke.ts), the way
// the node measures it -- nothing here is typed in.

const { w: W, h: H } = FORCE_PANEL;
const HEAD = 34;
const FOOT = 66;
const SPLIT = 214; // where the peak column ends and the curve begins

const M = measureStroke();
const STROKES = recentStrokes();
const AVG = STROKES.reduce((a, v) => a + measureStroke(v).peakKg, 0) / STROKES.length;

// Curve panel geometry.
const CX0 = SPLIT + 34;
const CX1 = W - 18;
const CY0 = H - FOOT - 22;
const CY1 = HEAD + 40;
const KG_TOP = 70;
const GRID = [20, 40, 60];
const cx = (u: number) => CX0 + u * (CX1 - CX0);
const cy = (kg: number) => CY0 + (kg / KG_TOP) * (CY1 - CY0);

/** One drive as the node plots it, from just before the catch to just after
 *  the release, so the trace starts and ends on the baseline. */
function drive(v = STROKES[0], samples = 64) {
  const m = measureStroke(v);
  const a = m.catchT - 0.05;
  const b = m.releaseT + 0.08;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= samples; i++) {
    const t = a + ((b - a) * i) / samples;
    pts.push([cx(i / samples), cy(Math.max(0, strokeForce(t, v)))]);
  }
  return pts;
}

const THIS_PTS = drive();
const THIS_LINE = toPath(THIS_PTS, 0.2);
const THIS_AREA = `${THIS_LINE}L${cx(1).toFixed(1)} ${cy(0).toFixed(1)}L${cx(0).toFixed(1)} ${cy(0).toFixed(1)}Z`;
const LAST_LINE = toPath(drive(STROKES[1]), 0.2);
const PEAK_AT = (() => {
  let best = THIS_PTS[0];
  for (const p of THIS_PTS) if (p[1] < best[1]) best = p;
  return best;
})();

/** What the screen says, for the device that contains it. */
export function forceScreenLabel(seat: number, peakKg: number, avgKg: number) {
  return `Seat ${seat}: peak force ${peakKg.toFixed(1)} kilograms against a ten-stroke average of ${avgKg.toFixed(
    1
  )}, with this stroke's force curve drawn over the last one.`;
}

export const FORCE_SCREEN_DEFAULTS = { peakKg: M.peakKg, avgKg: AVG };

export function ForceScreen({
  seat = 5,
  peakKg = M.peakKg,
  avgKg = AVG,
  rate = EXAMPLE.spm,
  driveMs = M.driveMs,
  strokeNo = EXAMPLE.strokes,
  battery = 78,
  linked = true,
  idPrefix = "fs",
  frame,
}: {
  seat?: number;
  peakKg?: number;
  avgKg?: number;
  rate?: number;
  driveMs?: number;
  strokeNo?: number;
  battery?: number;
  linked?: boolean;
  /** Unique when more than one screen is on the page (clip path ids). */
  idPrefix?: string;
  /** Set when the screen is nested inside a device drawing. */
  frame?: { x: number; y: number; width: number; height: number };
}) {
  // The clip path and the rect inside it need different ids: the animator
  // grows the rect, found by id, to sweep the stroke across the panel.
  const clip = `${idPrefix}-sweep-clip`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role={frame ? undefined : "img"}
      aria-hidden={frame ? true : undefined}
      aria-label={frame ? undefined : forceScreenLabel(seat, peakKg, avgKg)}
      {...frame}
      className={frame ? undefined : "block h-full w-full"}
    >
      <defs>
        <clipPath id={clip}>
          <rect id={`${idPrefix}-sweep`} x={CX0 - 4} y={CY1 - 24} width={CX1 - CX0 + 8} height={CY0 - CY1 + 40} />
        </clipPath>
      </defs>
      <rect width={W} height={H} fill={SCREEN.bg} />

      {/* header */}
      <text x={16} y={22} fill={SCREEN.value} fontFamily={mono} fontSize={14} letterSpacing={2.2} fontWeight={600}>
        SEAT {seat}
      </text>
      <g>
        <circle cx={W - 118} cy={17} r={4} fill={linked ? SCREEN.ok : SCREEN.label} />
        <text x={W - 108} y={22} fill={linked ? SCREEN.ok : SCREEN.label} fontFamily={mono} fontSize={13} letterSpacing={1.6}>
          VIEVE
        </text>
        <text x={W - 16} y={22} textAnchor="end" fill={SCREEN.value} fontFamily={mono} fontSize={13} letterSpacing={0.6}>
          {battery}%
        </text>
      </g>
      <line x1={0} x2={W} y1={HEAD} y2={HEAD} stroke={SCREEN.line} />

      {/* peak, the number a rower reads mid-piece */}
      <text x={16} y={HEAD + 34} fill={SCREEN.label} fontFamily={mono} fontSize={13} letterSpacing={1.8}>
        PEAK FORCE
      </text>
      <text
        id={`${idPrefix}-peak`}
        x={14}
        y={HEAD + 112}
        fill={SCREEN.trace}
        fontFamily={sans}
        fontSize={76}
        fontWeight={800}
        style={{ fontStretch: "112%" }}
      >
        {peakKg.toFixed(1)}
      </text>
      <text x={16} y={HEAD + 142} fill={SCREEN.label} fontFamily={mono} fontSize={13} letterSpacing={0.8}>
        kg · avg 10{" "}
        <tspan fill={SCREEN.value}>{avgKg.toFixed(1)}</tspan>
      </text>
      <line x1={SPLIT} x2={SPLIT} y1={HEAD} y2={H - FOOT} stroke={SCREEN.line} />

      {/* the curve: this stroke over the last */}
      <text x={CX0 - 16} y={HEAD + 24} fill={SCREEN.label} fontFamily={mono} fontSize={12} letterSpacing={1.6}>
        FORCE CURVE
      </text>
      <g fontFamily={mono} fontSize={11} letterSpacing={1}>
        <line x1={CX1 - 116} x2={CX1 - 100} y1={HEAD + 20} y2={HEAD + 20} stroke={SCREEN.trace} strokeWidth={2.5} />
        <text x={CX1 - 94} y={HEAD + 24} fill={SCREEN.trace}>THIS</text>
        <line x1={CX1 - 52} x2={CX1 - 36} y1={HEAD + 20} y2={HEAD + 20} stroke={SCREEN.label} strokeWidth={2} strokeDasharray="4 3" />
        <text x={CX1 - 30} y={HEAD + 24} fill={SCREEN.label}>LAST</text>
      </g>
      {GRID.map((kg) => (
        <g key={kg}>
          <line x1={CX0 - 8} x2={CX1} y1={cy(kg)} y2={cy(kg)} stroke={SCREEN.grid} />
          <text x={CX0 - 14} y={cy(kg) + 4} textAnchor="end" fill={SCREEN.label} fontFamily={mono} fontSize={10}>
            {kg}
          </text>
        </g>
      ))}
      <line x1={CX0 - 8} x2={CX1} y1={cy(0)} y2={cy(0)} stroke={SCREEN.line} />
      {/* the stroke before, for comparison: always there, so this one draws over it */}
      <path d={LAST_LINE} fill="none" stroke={SCREEN.label} strokeOpacity={0.85} strokeWidth={1.75} strokeDasharray="5 4" />
      <g clipPath={`url(#${clip})`}>
        <path d={THIS_AREA} fill={SCREEN.traceFill} />
        <path d={THIS_LINE} fill="none" stroke={SCREEN.trace} strokeWidth={2.5} strokeLinejoin="round" />
        <g id={`${idPrefix}-cursor`} transform={`translate(${PEAK_AT[0].toFixed(1)} ${PEAK_AT[1].toFixed(1)})`}>
          <circle r={5.5} fill={SCREEN.bg} stroke={SCREEN.value} strokeWidth={2.5} />
        </g>
      </g>

      {/* footer: the three numbers that matter after the stroke */}
      <line x1={0} x2={W} y1={H - FOOT} y2={H - FOOT} stroke={SCREEN.line} />
      {[
        ["RATE", rate.toFixed(1), ""],
        ["DRIVE TIME", (driveMs / 1000).toFixed(2), "s"],
        ["STROKE", String(strokeNo), ""],
      ].map(([label, value, unit], i) => {
        const x = 16 + i * ((W - 32) / 3);
        return (
          <g key={label}>
            {i > 0 && <line x1={x - 16} x2={x - 16} y1={H - FOOT} y2={H} stroke={SCREEN.line} />}
            <text x={x} y={H - FOOT + 22} fill={SCREEN.label} fontFamily={mono} fontSize={11} letterSpacing={1.6}>
              {label}
            </text>
            <text x={x} y={H - 16} fill={SCREEN.value} fontFamily={sans} fontSize={30} fontWeight={700} style={{ fontStretch: "108%" }}>
              {value}
              {unit && (
                <tspan fill={SCREEN.label} fontFamily={mono} fontSize={13} fontWeight={400}>
                  {" "}
                  {unit}
                </tspan>
              )}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Where the sweep clip and the cursor sit, for the hero's animation. */
export const FORCE_CURVE_GEOMETRY = {
  x0: CX0,
  x1: CX1,
  y0: CY0,
  y1: CY1,
  kgTop: KG_TOP,
  clipY: CY1 - 24,
  clipH: CY0 - CY1 + 40,
  points: THIS_PTS,
};
