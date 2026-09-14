import { Download } from "lucide-react";
import { InView } from "./in-view";

// The files a node writes for every session (storage.cpp), as you'd download them.
const FILES = [
  ["strokes.csv", "Every stroke's numbers"],
  ["curves.bin", "Every force curve"],
  ["events.csv", "What happened, and when"],
  ["meta.json", "Boat, seat and settings"],
] as const;

export function SessionFiles() {
  return (
    <InView className="w-full overflow-hidden rounded-lg border border-line bg-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-line px-4 py-2.5">
        <span className="font-semibold whitespace-nowrap">Session S0023</span>
        <span className="readout text-xs whitespace-nowrap text-muted-foreground">147 strokes · 18:42</span>
      </div>
      <ul className="divide-y divide-line">
        {FILES.map(([name, what], i) => (
          <li
            key={name}
            className="rise flex items-center justify-between gap-4 px-4 py-2"
            style={{ "--i": i + 2 } as React.CSSProperties}
          >
            <span className="min-w-0">
              <span className="readout block text-sm text-trace">{name}</span>
              <span className="block truncate text-sm text-muted-foreground">{what}</span>
            </span>
            <Download aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </li>
        ))}
      </ul>
    </InView>
  );
}
