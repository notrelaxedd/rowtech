import Image from "next/image";
import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

// Screens and soft-key actions as implemented in LoadCellNode_v9/ui.cpp
// (softKeyLabels + uiHandleButtons). Images are pixel-exact firmware renders.
// CAPTURE and INFO exist on the device; the tour shows the three a crew uses.
export const SCREENS = [
  {
    id: "live",
    title: "Force, as it happens",
    body: "A big-digit readout over a graph of the stroke you're taking. Every catch wipes it and starts the next, so you only ever see the stroke in hand.",
    keys: [
      ["TARE", "Zero the cell. Hold to reset peaks."],
      ["NEXT", "Next screen. Hold to come back to LIVE."],
      ["UNITS", "Cycle g, kg, N and lbf. Hold to clear an overload."],
    ],
  },
  {
    id: "stroke",
    title: "The last stroke, taken apart",
    body: "Rate and stroke count, drive and recovery, peak and where it lands, impulse, rise rate, consistency and work by thirds, with the stroke's force curve underneath.",
    keys: [
      ["RESET", "Reset peaks."],
      ["NEXT", "Next screen. Hold to come back to LIVE."],
      ["CURVE", "Redraw the curve."],
    ],
  },
  {
    id: "session",
    title: "Every session, on the card",
    body: "Sessions start on the first stroke, close themselves after two idle minutes, and are saved as they're recorded. Switch the boat off at the dock without a second thought.",
    keys: [
      ["REC", "Start or stop a session."],
      ["NEXT", "Next screen. Hold to come back to LIVE."],
      ["PRUNE", "Hold to clear out the oldest sessions."],
    ],
  },
] as const;

export function ScreenTourView({
  i,
  onSelect,
  onKey,
  tabRef,
}: {
  i: number;
  onSelect?: (n: number) => void;
  onKey?: (e: KeyboardEvent) => void;
  tabRef?: (n: number) => (el: HTMLButtonElement | null) => void;
}) {
  const s = SCREENS[i];
  return (
    <div>
      <div role="tablist" aria-label="Device screens" onKeyDown={onKey} className="-mx-5 flex gap-1 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        {SCREENS.map((x, n) => (
          <button
            key={x.id}
            ref={tabRef?.(n)}
            role="tab"
            id={`tab-${x.id}`}
            aria-selected={n === i}
            aria-controls={`panel-${x.id}`}
            tabIndex={n === i ? 0 : -1}
            onClick={onSelect && (() => onSelect(n))}
            className={cn(
              "readout min-h-11 shrink-0 rounded-md px-4 text-sm tracking-[0.08em] uppercase transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace",
              n === i ? "bg-white/[0.07] text-trace" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {x.id}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${s.id}`}
        aria-labelledby={`tab-${s.id}`}
        className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-12"
      >
        <div className="rounded-xl bg-[#0b0d10] p-2.5 ring-1 ring-white/10 sm:p-3.5">
          <Image
            key={s.id}
            src={`/product/${s.id}.png`}
            alt={`The ${s.id.toUpperCase()} screen as rendered by the v9 firmware.`}
            width={960}
            height={640}
            unoptimized
            className="block h-auto w-full rounded-[3px]"
          />
        </div>
        <div>
          <h3 className="type-h3 text-[1.5rem]">{s.title}</h3>
          <p className="type-body mt-3 text-muted-foreground">{s.body}</p>
          <dl className="mt-6 divide-y divide-line border-y border-line">
            {s.keys.map(([k, v], n) => (
              <div key={k} className="grid grid-cols-[5.5rem_1fr] items-baseline gap-4 py-3">
                <dt className="readout text-sm text-foreground">
                  <span aria-hidden className="mr-2 text-muted-foreground">{["↑", "○", "↓"][n]}</span>
                  {k}
                </dt>
                <dd className="text-[0.9375rem] text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
