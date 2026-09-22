import type { Ref } from "react";
import { cn } from "@/lib/utils";

// Top-down eight: a node on every rigger, each reporting to the cox box at the
// stern. A diagram of the system in development, not a drawing of hardware.
// Scrolling through it connects the seats one at a time, bow to stroke; with
// all eight in, the cox box lights and its clock pulse starts.
const HULL = "M28 150 C 220 118, 760 116, 972 150 C 760 184, 220 182, 28 150 Z";
const SEAT_X = [236, 318, 400, 482, 564, 646, 728, 810]; // bow (1) to stroke (8)
const BOX = { x: 872, y: 150 };

export function CoxBoxView({ lit, figureRef }: { lit: number; figureRef?: Ref<HTMLElement> }) {
  const all = lit >= 8;
  return (
    <figure ref={figureRef} className="m-0">
      <div className="rounded-lg border border-line bg-panel px-3 py-6 sm:px-6 sm:py-8">
        <svg
          viewBox="0 44 1000 212"
          role="img"
          aria-label="Diagram: an eight seen from above, with a RowTech node on each of the eight riggers sending its data to the cox box at the stern."
          className="block h-auto w-full"
        >
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path d={HULL} fill="#12171c" stroke="rgb(255 255 255 / 0.18)" strokeWidth={1.5} />
          <line x1={60} x2={950} y1={150} y2={150} stroke="rgb(255 255 255 / 0.06)" />

          {SEAT_X.map((x, i) => {
            const side = i % 2 === 0 ? -1 : 1; // riggers alternate sides
            const tipY = 150 + side * 96;
            const nodeY = 150 + side * 52;
            const on = i < lit;
            return (
              <g key={x}>
                <rect x={x - 13} y={142} width={26} height={16} rx={3} fill="rgb(255 255 255 / 0.07)" />
                <line x1={x - 18} x2={x} y1={150 + side * 24} y2={tipY} stroke="rgb(255 255 255 / 0.28)" strokeWidth={2} />
                <line x1={x + 18} x2={x} y1={150 + side * 24} y2={tipY} stroke="rgb(255 255 255 / 0.28)" strokeWidth={2} />
                <path
                  d={`M${x} ${nodeY} Q ${(x + BOX.x) / 2} ${nodeY + side * 34} ${BOX.x} ${BOX.y}`}
                  fill="none"
                  stroke="var(--trace)"
                  strokeWidth={1.5}
                  className={cn("rt-signal transition-[stroke-opacity] duration-500 ease-out", !on && "[animation-play-state:paused]")}
                  strokeOpacity={on ? 0.6 : 0}
                  style={{ animationDelay: `${-i * 0.15}s` }}
                />
                <rect
                  x={x - 7}
                  y={nodeY - 7}
                  width={14}
                  height={14}
                  rx={3}
                  fill={on ? "rgb(34 227 239 / 0.25)" : "#07090b"}
                  stroke={on ? "var(--trace)" : "rgb(255 255 255 / 0.3)"}
                  strokeWidth={2}
                  filter={on ? "url(#glow)" : undefined}
                  className="transition-[fill,stroke] duration-300 ease-out"
                />
              </g>
            );
          })}

          {all && <circle cx={BOX.x} cy={BOX.y} r={16} fill="none" stroke="var(--trace)" className="rt-ping" />}
          <rect
            x={BOX.x - 16}
            y={BOX.y - 11}
            width={32}
            height={22}
            rx={4}
            fill={all ? "var(--trace)" : "rgb(255 255 255 / 0.12)"}
            stroke={all ? "none" : "rgb(255 255 255 / 0.35)"}
            filter={all ? "url(#glow)" : undefined}
            className="transition-[fill] duration-500 ease-out"
          />
        </svg>
        <div className="readout mt-4 flex justify-between gap-4 text-xs text-muted-foreground">
          <span>bow</span>
          <span aria-hidden>
            <span className={cn("transition-colors duration-300", all ? "text-trace" : "text-foreground")}>{lit}/8</span> seats on one
            clock <span>→</span> <span className="text-trace">cox box</span> · stern
          </span>
        </div>
      </div>
    </figure>
  );
}
