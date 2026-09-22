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

// Soft-key boxes in the screen renders (960x640, the panel at 2x): the right
// 84 panel px, split into three between the header and the bottom edge.
const SOFT_KEYS = [
  { left: "82.5%", width: "17.5%", top: "8.75%", height: "29.7%" },
  { left: "82.5%", width: "17.5%", top: "39.1%", height: "29.7%" },
  { left: "82.5%", width: "17.5%", top: "69.4%", height: "29.7%" },
];

export function ScreenTourView({
  i,
  onSelect,
  onKey,
  tabRef,
  hot = null,
  pressed = 0,
  onHot,
  onPress,
}: {
  i: number;
  onSelect?: (n: number) => void;
  onKey?: (e: KeyboardEvent) => void;
  tabRef?: (n: number) => (el: HTMLButtonElement | null) => void;
  /** The button under the pointer or focus: its soft key lights on screen. */
  hot?: number | null;
  /** Bumped on every press, to replay the press flash. */
  pressed?: number;
  onHot?: (n: number | null) => void;
  onPress?: (n: number) => void;
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
        <div className="relative rounded-xl bg-[#0b0d10] p-2.5 ring-1 ring-white/10 sm:p-3.5">
          <Image
            key={s.id}
            src={`/product/${s.id}.png`}
            alt={`The ${s.id.toUpperCase()} screen as rendered by the v9 firmware.`}
            width={960}
            height={640}
            unoptimized
            className="block h-auto w-full rounded-[3px]"
          />
          {/* The three soft keys down the right of the screen, where the
              firmware draws each button's label. */}
          <div aria-hidden className="pointer-events-none absolute inset-2.5 sm:inset-3.5">
            {SOFT_KEYS.map((k, n) => (
              <span
                key={`${n}-${hot === n ? pressed : 0}`}
                style={k}
                className={cn(
                  "absolute rounded-[2px] transition-[box-shadow,background-color] duration-200",
                  hot === n ? "bg-trace/15 shadow-[inset_0_0_0_2px_var(--trace),0_0_18px_rgb(34_227_239/0.35)]" : "bg-transparent",
                  hot === n && pressed > 0 && "rt-key-press"
                )}
              />
            ))}
          </div>
        </div>
        <div>
          <h3 className="type-h3 text-[1.5rem]">{s.title}</h3>
          <p className="type-body mt-3 text-muted-foreground">{s.body}</p>
          <ul aria-label="Buttons on this screen" className="mt-6 divide-y divide-line border-y border-line">
            {s.keys.map(([k, v], n) => (
              <li key={k}>
                <button
                  type="button"
                  onPointerEnter={onHot && (() => onHot(n))}
                  onPointerLeave={onHot && (() => onHot(null))}
                  onFocus={onHot && (() => onHot(n))}
                  onBlur={onHot && (() => onHot(null))}
                  onClick={onPress && (() => onPress(n))}
                  className={cn(
                    "grid w-full grid-cols-[5.5rem_1fr] items-baseline gap-4 py-3 text-left transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trace",
                    hot === n && "bg-white/[0.03]"
                  )}
                >
                  <span className={cn("readout text-sm transition-colors", hot === n ? "text-trace" : "text-foreground")}>
                    <span aria-hidden className={cn("mr-2 transition-colors", hot === n ? "text-trace" : "text-muted-foreground")}>
                      {["↑", "○", "↓"][n]}
                    </span>
                    {k}
                  </span>
                  <span className="text-[0.9375rem] text-muted-foreground">{v}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">Point at a button to find it on the screen. NEXT works like it does on the water.</p>
        </div>
      </div>
    </div>
  );
}
