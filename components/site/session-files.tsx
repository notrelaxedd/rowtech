import { Check } from "lucide-react";

// The files a node writes for every session (LoadCellNode storage.cpp), as
// they come off it over its WiFi. Inside the "how it works" steps, which own
// the reveal: once step 3 is in, each file's bar fills in turn and ticks.
const FILES = [
  ["strokes.csv", "Every stroke's numbers"],
  ["curves.bin", "Every force curve"],
  ["events.csv", "What happened, and when"],
  ["meta.json", "Seat, settings and calibration"],
] as const;

export function SessionFiles() {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-line bg-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-line px-4 py-2.5">
        <span className="font-semibold whitespace-nowrap">Session S0023</span>
        <span className="readout text-xs whitespace-nowrap text-muted-foreground">147 strokes · 18:42</span>
      </div>
      <ul className="divide-y divide-line">
        {FILES.map(([name, what], i) => (
          <li key={name} className="relative flex items-center justify-between gap-4 px-4 py-2" style={{ "--i": i } as React.CSSProperties}>
            <span aria-hidden className="dl-bar absolute inset-x-0 bottom-0 h-px bg-trace/60" />
            <span className="min-w-0">
              <span className="readout block text-sm text-trace">{name}</span>
              <span className="block truncate text-sm text-muted-foreground">{what}</span>
            </span>
            <Check aria-hidden className="dl-done size-4 shrink-0 text-ok" />
          </li>
        ))}
      </ul>
    </div>
  );
}
