import type { Ref } from "react";
import { driveShape, toPath } from "@/lib/stroke";
import { RIVER, headingUp } from "@/lib/river";
import { SCREEN, VIEVE_PANEL, mono, sans } from "./screen-theme";

// Vieve's screen, after "Vieve V1 + Force, concept A": split and rate down the
// left, the river heading-up in the middle, and all eight seats' force down
// the right. In the site's colours: cyan is the live value, green is linked,
// amber is the seat that's off the crew.

const { w: W, h: H } = VIEVE_PANEL;
const HEAD = 30;
const FOOT = 34;
const COL1 = 300; // split column
const COL2 = 528; // map column ends here

type CrewCard = { seat: number; label: string; peak: number; k: number; off?: boolean };

/** The crew, as Vieve shows them: stroke top left, bow bottom right. */
const CREW: readonly CrewCard[] = [
  { seat: 8, label: "8 STR", peak: 62.4, k: 1.0 },
  { seat: 7, label: "7", peak: 60.6, k: 0.95 },
  { seat: 6, label: "6", peak: 64.1, k: 1.04 },
  { seat: 5, label: "5", peak: 61.0, k: 0.9 },
  { seat: 4, label: "4", peak: 59.0, k: 0.98 },
  { seat: 3, label: "3", peak: 52.7, k: 0.82, off: true },
  { seat: 2, label: "2", peak: 59.6, k: 0.93 },
  { seat: 1, label: "1 BOW", peak: 57.5, k: 0.96 },
];

const CARD = { w: 126, h: 84, gap: 6 };
const CARDS_X = COL2 + 12;

/** A seat's stroke, small enough to read at a glance. */
function miniCurve(k: number, w: number, h: number) {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 26; i++) {
    const u = i / 26;
    pts.push([u * w, h - driveShape(u) * k * h]);
  }
  return toPath(pts, 0.25);
}

const MAP = { x: COL1 + 12, y: HEAD + 8, w: COL2 - COL1 - 24, h: H - HEAD - FOOT - 16 };
const BOAT = { x: MAP.w / 2, y: MAP.h * 0.66 };
// The panel is half the sketch's width, so the river is drawn at half size.
const MAP_SCALE = 0.46;
const view = headingUp(0.3, BOAT.x, BOAT.y, MAP_SCALE);

export type VieveScreenRefs = { map?: Ref<SVGGElement> };

/** What the screen says, for the device that contains it. */
export function vieveScreenLabel(split: string, rate: number) {
  return `Split ${split} per 500 metres, rate ${rate}, the river heading-up with the race line on it, and the peak force of all eight seats.`;
}

export function VieveScreen({
  split = "1:52.4",
  rate = 32,
  driveSpeed = 5.1,
  distance = 1284,
  elapsed = "4:47.9",
  piece = "PIECE 2 · 2000 m",
  battery = 82,
  refs,
  idPrefix = "vs",
  frame,
}: {
  split?: string;
  rate?: number;
  driveSpeed?: number;
  distance?: number;
  elapsed?: string;
  piece?: string;
  battery?: number;
  refs?: VieveScreenRefs;
  idPrefix?: string;
  frame?: { x: number; y: number; width: number; height: number };
}) {
  const clip = `${idPrefix}-map`;
  const tile = (label: string, value: string, unit: string, x: number, y: number, accent = false) => (
    <g key={label}>
      <rect x={x} y={y} width={(COL1 - 36) / 2} height={104} rx={6} fill={SCREEN.raised} />
      <text x={x + 12} y={y + 22} fill={SCREEN.label} fontFamily={mono} fontSize={11} letterSpacing={1.4}>
        {label}
      </text>
      <text
        x={x + 12}
        y={y + 78}
        fill={accent ? SCREEN.trace : SCREEN.value}
        fontFamily={sans}
        fontSize={38}
        fontWeight={800}
        style={{ fontStretch: "108%" }}
      >
        {value}
        <tspan fill={SCREEN.label} fontFamily={mono} fontSize={13} fontWeight={400}>
          {unit}
        </tspan>
      </text>
    </g>
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role={frame ? undefined : "img"}
      aria-hidden={frame ? true : undefined}
      aria-label={frame ? undefined : vieveScreenLabel(split, rate)}
      {...frame}
      className={frame ? undefined : "block h-full w-full"}
    >
      <defs>
        <clipPath id={clip}>
          <rect x={MAP.x} y={MAP.y} width={MAP.w} height={MAP.h} rx={6} />
        </clipPath>
      </defs>
      <rect width={W} height={H} fill={SCREEN.bg} />

      {/* header: who's linked, and where we are in the piece */}
      <text x={14} y={20} fill={SCREEN.trace} fontFamily={mono} fontSize={13} letterSpacing={2.4} fontWeight={600}>
        VIEVE
      </text>
      <circle cx={84} cy={15} r={3.5} fill={SCREEN.ok} />
      <text x={94} y={20} fill={SCREEN.label} fontFamily={mono} fontSize={12} letterSpacing={0.8}>
        GPS 10 Hz
      </text>
      <circle cx={186} cy={15} r={3.5} fill={SCREEN.ok} />
      <text x={196} y={20} fill={SCREEN.label} fontFamily={mono} fontSize={12} letterSpacing={0.8}>
        CREW 8/8
      </text>
      <text x={W - 58} y={20} textAnchor="end" fill={SCREEN.label} fontFamily={mono} fontSize={12} letterSpacing={0.8}>
        {piece}
      </text>
      <text x={W - 14} y={20} textAnchor="end" fill={SCREEN.value} fontFamily={mono} fontSize={12}>
        {battery}%
      </text>
      <line x1={0} x2={W} y1={HEAD} y2={HEAD} stroke={SCREEN.line} />

      {/* split: the number the cox calls off */}
      <text x={14} y={HEAD + 26} fill={SCREEN.label} fontFamily={mono} fontSize={12} letterSpacing={1.6}>
        SPLIT /500 m
      </text>
      <text x={12} y={HEAD + 104} fill={SCREEN.value} fontFamily={sans} fontSize={78} fontWeight={800} style={{ fontStretch: "110%" }}>
        {split}
      </text>
      {tile("RATE", String(rate), " spm", 14, HEAD + 128)}
      {tile("DRIVE SPEED", driveSpeed.toFixed(1), " m/s", 14 + (COL1 - 36) / 2 + 10, HEAD + 128, true)}
      {tile("DISTANCE", String(distance), " m", 14, HEAD + 242)}
      {tile("ELAPSED", elapsed, "", 14 + (COL1 - 36) / 2 + 10, HEAD + 242)}
      <line x1={COL1} x2={COL1} y1={HEAD} y2={H - FOOT} stroke={SCREEN.line} />

      {/* the river, heading up, with the line through the bends */}
      <rect x={MAP.x} y={MAP.y} width={MAP.w} height={MAP.h} rx={6} fill="#070d10" />
      <g clipPath={`url(#${clip})`}>
        <g transform={`translate(${MAP.x} ${MAP.y})`}>
          <g ref={refs?.map} transform={view.transform}>
            <path d={RIVER.water} fill="#0c1a22" />
            <path d={RIVER.left} fill="none" stroke="rgb(255 255 255 / 0.22)" strokeWidth={3} />
            <path d={RIVER.right} fill="none" stroke="rgb(255 255 255 / 0.22)" strokeWidth={3} />
            <path d={RIVER.race} fill="none" stroke={SCREEN.trace} strokeWidth={3} strokeDasharray="9 8" strokeOpacity={0.9} />
          </g>
          {/* the boat, always pointing up */}
          <g transform={`translate(${BOAT.x} ${BOAT.y})`}>
            <circle r={18} fill={SCREEN.trace} fillOpacity={0.12} />
            <path d="M0 -15 C 3.2 -7, 3.2 7, 0 12 C -3.2 7, -3.2 -7, 0 -15 Z" fill={SCREEN.value} />
          </g>
        </g>
      </g>
      <g transform={`translate(${MAP.x + 8} ${MAP.y + MAP.h - 12})`}>
        <rect x={-2} y={-14} width={74} height={18} rx={4} fill={SCREEN.trace} fillOpacity={0.16} />
        <text x={4} y={-1} fill={SCREEN.trace} fontFamily={mono} fontSize={10} letterSpacing={1}>
          RACE LINE
        </text>
      </g>
      <g transform={`translate(${MAP.x + MAP.w - 88} ${MAP.y + MAP.h - 32})`}>
        <rect x={-2} y={-14} width={86} height={18} rx={4} fill={SCREEN.warn} fillOpacity={0.16} />
        <text x={4} y={-1} fill={SCREEN.warn} fontFamily={mono} fontSize={10} letterSpacing={0.6}>
          Δ +3 m stbd
        </text>
      </g>

      {/* every seat, at a glance */}
      <text x={CARDS_X} y={HEAD + 20} fill={SCREEN.label} fontFamily={mono} fontSize={12} letterSpacing={1.6}>
        CREW FORCE
      </text>
      <text x={W - 14} y={HEAD + 20} textAnchor="end" fill={SCREEN.label} fontFamily={mono} fontSize={11} letterSpacing={1.2}>
        PEAK kg
      </text>
      {CREW.map((s, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = CARDS_X + col * (CARD.w + CARD.gap);
        const y = HEAD + 30 + row * (CARD.h + CARD.gap);
        const colour = s.off ? SCREEN.warn : SCREEN.trace;
        return (
          <g key={s.seat}>
            <rect
              x={x}
              y={y}
              width={CARD.w}
              height={CARD.h}
              rx={6}
              fill={SCREEN.raised}
              stroke={s.off ? SCREEN.warn : "transparent"}
              strokeWidth={1.5}
            />
            <text x={x + 10} y={y + 20} fill={SCREEN.label} fontFamily={mono} fontSize={11} letterSpacing={0.8}>
              {s.label}
            </text>
            <text x={x + CARD.w - 10} y={y + 24} textAnchor="end" fill={colour} fontFamily={sans} fontSize={24} fontWeight={800}>
              {s.peak.toFixed(0)}
            </text>
            <g transform={`translate(${x + 10} ${y + CARD.h - 10})`}>
              <path
                d={`${miniCurve(s.k, CARD.w - 20, 52)}L${CARD.w - 20} 52L0 52Z`}
                fill={colour}
                fillOpacity={0.16}
                transform="translate(0 -52)"
              />
              <path d={miniCurve(s.k, CARD.w - 20, 52)} fill="none" stroke={colour} strokeWidth={2} transform="translate(0 -52)" />
            </g>
          </g>
        );
      })}

      {/* the cox's own controls, along the bottom */}
      <line x1={0} x2={W} y1={H - FOOT} y2={H - FOOT} stroke={SCREEN.line} />
      <circle cx={20} cy={H - 13} r={4} fill={SCREEN.ok} />
      <text x={32} y={H - 9} fill={SCREEN.ok} fontFamily={mono} fontSize={12} letterSpacing={1.4}>
        MIC LIVE
      </text>
      <text x={124} y={H - 9} fill={SCREEN.label} fontFamily={mono} fontSize={12} letterSpacing={1.2}>
        NOISE CANCEL ON
      </text>
      <text x={294} y={H - 9} fill={SCREEN.label} fontFamily={mono} fontSize={12} letterSpacing={1.2}>
        VOL 7
      </text>
      <text x={W - 14} y={H - 9} textAnchor="end" fill={SCREEN.label} fontFamily={mono} fontSize={12} letterSpacing={1.2}>
        MODE · RACE
      </text>
    </svg>
  );
}
