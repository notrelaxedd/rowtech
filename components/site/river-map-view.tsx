import type { Ref } from "react";
import { RIVER, headingUp } from "@/lib/river";

// Vieve's river map, sketched: heading-up, so the river turns under a boat
// that always points up the screen, with the race line drawn through the
// bends. The client (river-map.tsx) moves the boat by rewriting the map's
// transform each frame; this renders the first frame.
export const MAP = { w: 400, h: 400, bx: 200, by: 262 };
export const START = 0.18;

export function RiverMapView({ mapRef, northRef }: { mapRef?: Ref<SVGGElement>; northRef?: Ref<SVGGElement> }) {
  const first = headingUp(START, MAP.bx, MAP.by);
  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-lg border border-line bg-[#05070a]">
        <div className="readout flex items-center justify-between border-b border-line px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            <span className="text-trace">MAP</span> · heading up
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0 w-4 border-t border-dashed border-trace" /> race line
          </span>
        </div>
        <svg
          viewBox={`0 0 ${MAP.w} ${MAP.h}`}
          role="img"
          aria-label="Illustration: Vieve's river map, heading-up. The river turns beneath the boat as it moves, with the most efficient race line drawn through the bends."
          className="block h-auto w-full"
        >
          <g ref={mapRef} transform={first.transform} className="transition-opacity duration-500">
            <path d={RIVER.water} fill="#0c1a22" />
            <path d={RIVER.left} fill="none" stroke="rgb(255 255 255 / 0.28)" strokeWidth={2.5} />
            <path d={RIVER.right} fill="none" stroke="rgb(255 255 255 / 0.28)" strokeWidth={2.5} />
            <path d={RIVER.race} fill="none" stroke="var(--trace)" strokeWidth={2.5} strokeDasharray="7 7" strokeOpacity={0.85} />
          </g>

          {/* The boat, fixed, always pointing up. */}
          <g transform={`translate(${MAP.bx} ${MAP.by})`}>
            <circle r={26} fill="var(--trace)" fillOpacity={0.08} />
            <path d="M0 -17 C 3.2 -8, 3.2 8, 0 14 C -3.2 8, -3.2 -8, 0 -17 Z" fill="var(--foreground)" />
          </g>

          {/* North, turning the other way. */}
          <g transform={`translate(${MAP.w - 30} 30)`}>
            <circle r={16} fill="#05070a" stroke="rgb(255 255 255 / 0.2)" />
            <g ref={northRef} transform={`rotate(${(-first.heading).toFixed(2)})`}>
              <path d="M0 -11 L4 2 L0 -1 L-4 2 Z" fill="var(--warn)" />
              <text y={11} textAnchor="middle" className="fill-muted-foreground font-mono text-[8px]">
                N
              </text>
            </g>
          </g>
        </svg>
      </div>
      <figcaption className="mt-3 text-sm text-muted-foreground">Illustration of Vieve&rsquo;s map. The river turns; the boat always points up.</figcaption>
    </figure>
  );
}
