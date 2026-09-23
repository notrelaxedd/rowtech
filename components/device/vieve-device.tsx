import type { ReactNode } from "react";
import { SCREEN, mono } from "./screen-theme";
import { VieveScreen, vieveScreenLabel } from "./vieve-screen";

// Vieve V1, drawn: ~200 x 38 mm, a 4.3" screen and the three controls a cox
// can find without looking. After "Vieve V1 + Force, concept A", in the site's
// colours. No speaker on the face: the cox's calls go out of the headset port
// to the boat's own speakers.

export const VIEVE_KEYS = [
  { id: "start", label: "START / SPLIT", hint: "Big, glove-friendly, findable without looking." },
  { id: "mode", label: "MODE", hint: "Cycles race, map, crew force, drill." },
  { id: "vol", label: "VOL", hint: "Hold both ends to mute the mic." },
] as const;

export type VieveKeyId = (typeof VIEVE_KEYS)[number]["id"];

const W = 1320;
const H = 760;
const BODY = { x: 20, y: 20, w: 1280, h: 700, r: 56 };
const PANEL = { x: 92, y: 130, w: 740, h: 444 }; // 5:3, as the panel is
const START = { cx: 1024, cy: 250, r: 110 };
const MODE = { cx: 952, cy: 516, r: 70 };
const VOL = { x: 1100, y: 424, w: 100, h: 190, r: 50 };

export function VieveDevice({
  hot = null,
  screen,
  idPrefix = "vieve",
  className,
}: {
  hot?: VieveKeyId | null;
  screen?: ReactNode;
  idPrefix?: string;
  className?: string;
}) {
  const lit = (id: VieveKeyId) => hot === id;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Vieve V1, the RowTech cox box: a 4.3 inch screen and the START, MODE and volume keys. On the screen: ${vieveScreenLabel(
        "1:52.4",
        32
      )}`}
      className={className}
    >
      <defs>
        <linearGradient id={`${idPrefix}-shell`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#2b3238" />
          <stop offset="0.5" stopColor="#1c2125" />
          <stop offset="1" stopColor="#13171a" />
        </linearGradient>
        <linearGradient id={`${idPrefix}-face`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#1f2529" />
          <stop offset="1" stopColor="#161b1e" />
        </linearGradient>
        <radialGradient id={`${idPrefix}-start`} cx="0.36" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#7cf0f6" />
          <stop offset="1" stopColor="#12b9c6" />
        </radialGradient>
        <linearGradient id={`${idPrefix}-key`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#333b41" />
          <stop offset="1" stopColor="#212a2e" />
        </linearGradient>
        <filter id={`${idPrefix}-glow`} x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      <rect x={BODY.x} y={BODY.y} width={BODY.w} height={BODY.h} rx={BODY.r} fill={`url(#${idPrefix}-shell)`} />
      <rect
        x={BODY.x + 16}
        y={BODY.y + 16}
        width={BODY.w - 32}
        height={BODY.h - 32}
        rx={BODY.r - 14}
        fill={`url(#${idPrefix}-face)`}
        stroke="rgb(255 255 255 / 0.05)"
      />

      {/* wordmark and the link lamp */}
      <text x={98} y={92} fill={SCREEN.label} fontFamily={mono} fontSize={28} letterSpacing={12}>
        VIEVE
      </text>
      <circle cx={274} cy={82} r={8} fill={SCREEN.ok} />
      <circle cx={274} cy={82} r={16} fill={SCREEN.ok} opacity={0.3} filter={`url(#${idPrefix}-glow)`} />

      {/* screen */}
      <rect x={PANEL.x - 12} y={PANEL.y - 12} width={PANEL.w + 24} height={PANEL.h + 24} rx={14} fill="#05080a" stroke="rgb(255 255 255 / 0.07)" />
      {screen ?? <VieveScreen idPrefix={idPrefix} frame={{ ...PANEL, width: PANEL.w, height: PANEL.h }} />}

      {/* START / SPLIT */}
      {lit("start") && <circle cx={START.cx} cy={START.cy} r={START.r + 16} fill={SCREEN.trace} opacity={0.35} filter={`url(#${idPrefix}-glow)`} />}
      <circle cx={START.cx} cy={START.cy} r={START.r + 10} fill="#11161a" />
      <circle cx={START.cx} cy={START.cy} r={START.r} fill={`url(#${idPrefix}-start)`} />
      <text x={START.cx} y={START.cy + START.r + 40} textAnchor="middle" fill={SCREEN.label} fontFamily={mono} fontSize={20} letterSpacing={3}>
        START / SPLIT
      </text>

      {/* MODE */}
      {lit("mode") && <circle cx={MODE.cx} cy={MODE.cy} r={MODE.r + 10} fill={SCREEN.trace} opacity={0.3} filter={`url(#${idPrefix}-glow)`} />}
      <circle cx={MODE.cx} cy={MODE.cy} r={MODE.r} fill={`url(#${idPrefix}-key)`} stroke="rgb(255 255 255 / 0.16)" strokeWidth={2} />
      <text x={MODE.cx} y={MODE.cy + MODE.r + 34} textAnchor="middle" fill={SCREEN.label} fontFamily={mono} fontSize={18} letterSpacing={3}>
        MODE
      </text>

      {/* VOL rocker */}
      {lit("vol") && <rect x={VOL.x - 10} y={VOL.y - 10} width={VOL.w + 20} height={VOL.h + 20} rx={VOL.r + 10} fill={SCREEN.trace} opacity={0.3} filter={`url(#${idPrefix}-glow)`} />}
      <rect x={VOL.x} y={VOL.y} width={VOL.w} height={VOL.h} rx={VOL.r} fill={`url(#${idPrefix}-key)`} stroke="rgb(255 255 255 / 0.16)" strokeWidth={2} />
      <g stroke={SCREEN.label} strokeWidth={4} strokeLinecap="round">
        <line x1={VOL.x + VOL.w / 2 - 16} x2={VOL.x + VOL.w / 2 + 16} y1={VOL.y + 48} y2={VOL.y + 48} />
        <line x1={VOL.x + VOL.w / 2} x2={VOL.x + VOL.w / 2} y1={VOL.y + 32} y2={VOL.y + 64} />
        <line x1={VOL.x + VOL.w / 2 - 16} x2={VOL.x + VOL.w / 2 + 16} y1={VOL.y + VOL.h - 48} y2={VOL.y + VOL.h - 48} />
      </g>
      <text x={VOL.x + VOL.w / 2} y={VOL.y + VOL.h + 36} textAnchor="middle" fill={SCREEN.label} fontFamily={mono} fontSize={18} letterSpacing={3}>
        VOL
      </text>
    </svg>
  );
}
