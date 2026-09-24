import { Check } from "lucide-react";

// The files a node writes for every session (LoadCellNode storage.cpp), as
// they come off it over its WiFi. The session folder is named the way the
// firmware names it; the stroke count and duration are an example.
const FILES = [
  ["strokes.csv", "Every stroke's numbers"],
  ["curves.bin", "Every force curve"],
  ["events.csv", "What happened, and when"],
  ["meta.json", "Seat, settings and calibration"],
] as const;

export function SessionFiles() {
  return (
    <div className="instrument w-full overflow-hidden rounded-md">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-line px-4 py-2.5">
        <span className="readout font-semibold whitespace-nowrap">S0023</span>
        <span className="text-xs whitespace-nowrap text-muted-foreground">Example: 147 strokes, 18:42</span>
      </div>
      <ul className="divide-y divide-line">
        {FILES.map(([name, what]) => (
          <li key={name} className="flex items-center justify-between gap-4 px-4 py-2">
            <span className="min-w-0">
              <span className="readout block text-sm text-trace">{name}</span>
              <span className="block truncate text-sm text-muted-foreground">{what}</span>
            </span>
            <Check aria-hidden className="size-4 shrink-0 text-ok" />
          </li>
        ))}
      </ul>
    </div>
  );
}
