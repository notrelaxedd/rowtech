import type { ReactNode } from "react";
import { SCREEN, mono } from "./screen-theme";
import { FORCE_SCREEN_DEFAULTS, ForceScreen, forceScreenLabel } from "./force-screen";

// The Force seat node, drawn: 120 x 84 x 32 mm, a 3.5" screen, a snap-in seat
// badge and three sealed keys down the right edge. After "Vieve V1 + Force,
// concept A", in the site's colours. Vector, so it is crisp at any size and
// the screen inside it is the real screen component, not a picture of one.

export const FORCE_KEYS = [
  { id: "view", label: "VIEW", hint: "Cycle what the screen shows." },
  { id: "tare", label: "TARE", hint: "Zero the cell before you push off." },
  { id: "power", label: "POWER", hint: "Hold to switch the node on or off." },
] as const;

export type ForceKeyId = (typeof FORCE_KEYS)[number]["id"];

const W = 1180;
const H = 800;
const BODY = { x: 24, y: 24, w: 1020, h: 740, r: 46 };
const PANEL = { x: 86, y: 90, w: 702, h: 468 }; // the screen window, 3:2 like the panel
const KEY_X = 900;
const KEY_Y = [372, 496, 620];
const KEY_R = 52;
const BADGE = { x: 838, y: 96, w: 124, h: 150, r: 22 };

export function ForceDevice({
  seat = 5,
  hot = null,
  screen,
  idPrefix = "force",
  className,
}: {
  seat?: number;
  /** A key lit because it is being pointed at. */
  hot?: ForceKeyId | null;
  /** Overrides the still screen, for the animated hero. */
  screen?: ReactNode;
  idPrefix?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`The Force seat node, concept design: a 3.5 inch screen, a seat badge reading ${seat}, and three keys down its right edge. On the screen: ${
        screen ? "the stroke being taken." : forceScreenLabel(seat, FORCE_SCREEN_DEFAULTS.peakKg, FORCE_SCREEN_DEFAULTS.avgKg)
      }`}
      className={className}
    >
      <defs>
        <linearGradient id={`${idPrefix}-shell`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#2b3238" />
          <stop offset="0.55" stopColor="#1d2226" />
          <stop offset="1" stopColor="#14181b" />
        </linearGradient>
        <linearGradient id={`${idPrefix}-face`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#1e2428" />
          <stop offset="1" stopColor="#171c20" />
        </linearGradient>
        <linearGradient id={`${idPrefix}-key`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#333b41" />
          <stop offset="1" stopColor="#222a2f" />
        </linearGradient>
        <filter id={`${idPrefix}-glow`} x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>

      {/* body */}
      <rect x={BODY.x} y={BODY.y} width={BODY.w} height={BODY.h} rx={BODY.r} fill={`url(#${idPrefix}-shell)`} />
      <rect
        x={BODY.x + 14}
        y={BODY.y + 14}
        width={BODY.w - 28}
        height={BODY.h - 28}
        rx={BODY.r - 12}
        fill={`url(#${idPrefix}-face)`}
        stroke="rgb(255 255 255 / 0.05)"
      />

      {/* the screen window, and the screen in it */}
      <rect x={PANEL.x - 10} y={PANEL.y - 10} width={PANEL.w + 20} height={PANEL.h + 20} rx={14} fill="#05080a" stroke="rgb(255 255 255 / 0.07)" />
      {screen ?? <ForceScreen seat={seat} idPrefix={idPrefix} frame={{ ...PANEL, width: PANEL.w, height: PANEL.h }} />}

      {/* snap-in seat badge */}
      <rect x={BADGE.x} y={BADGE.y} width={BADGE.w} height={BADGE.h} rx={BADGE.r} fill={SCREEN.trace} />
      <text
        x={BADGE.x + BADGE.w / 2}
        y={BADGE.y + BADGE.h / 2 + 34}
        textAnchor="middle"
        fill="#03161a"
        fontFamily="var(--font-archivo), sans-serif"
        fontSize={96}
        fontWeight={800}
        style={{ fontStretch: "110%" }}
      >
        {seat}
      </text>

      {/* three sealed keys */}
      {FORCE_KEYS.map((k, i) => {
        const on = hot === k.id;
        return (
          <g key={k.id}>
            {on && <circle cx={KEY_X} cy={KEY_Y[i]} r={KEY_R + 6} fill={SCREEN.trace} opacity={0.4} filter={`url(#${idPrefix}-glow)`} />}
            <circle
              cx={KEY_X}
              cy={KEY_Y[i]}
              r={KEY_R}
              fill={`url(#${idPrefix}-key)`}
              stroke={on ? SCREEN.trace : "rgb(255 255 255 / 0.16)"}
              strokeWidth={on ? 3 : 2}
              className="transition-[stroke] duration-200"
            />
            {/* the moulded rim catching the light */}
            <path
              d={`M${KEY_X - KEY_R * 0.72} ${KEY_Y[i] - KEY_R * 0.5} A ${KEY_R} ${KEY_R} 0 0 1 ${KEY_X + KEY_R * 0.4} ${KEY_Y[i] - KEY_R * 0.88}`}
              fill="none"
              stroke="rgb(255 255 255 / 0.14)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </g>
        );
      })}

      {/* link LED and the wordmark */}
      <circle cx={KEY_X} cy={700} r={7} fill={SCREEN.ok} />
      <circle cx={KEY_X} cy={700} r={13} fill={SCREEN.ok} opacity={0.35} filter={`url(#${idPrefix}-glow)`} />
      <text x={BODY.x + 62} y={694} fill={SCREEN.label} fontFamily={mono} fontSize={30} letterSpacing={10}>
        FORCE
      </text>
    </svg>
  );
}

/** Where each key sits, as a fraction of the drawing: for labels beside it. */
export const FORCE_KEY_POSITIONS = FORCE_KEYS.map((k, i) => ({
  id: k.id,
  left: (KEY_X / W) * 100,
  top: (KEY_Y[i] / H) * 100,
}));
