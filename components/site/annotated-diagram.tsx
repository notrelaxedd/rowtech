"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A box on the drawing, as percentages of its width and height. */
export type Region = { x: number; y: number; w: number; h: number; round?: boolean };

export type Annotation = {
  id: string;
  label: string;
  body: string;
  /** Where the numbered marker sits, in % of the drawing. */
  at: { x: number; y: number };
  /** The part it points at, outlined while the note is active. */
  region: Region;
};

/**
 * A drawing with numbered markers on it and the notes beside it. Pointing at
 * a marker or a note (or focusing either, or tapping) outlines that part of
 * the drawing and lights the note; everything else steps back.
 */
export function AnnotatedDiagram({
  drawing,
  ratio,
  notes,
  caption,
  label,
}: {
  drawing: ReactNode;
  /** width / height of the drawing, so markers land on it exactly. */
  ratio: number;
  notes: readonly Annotation[];
  caption: string;
  /** Names the list of notes for assistive tech. */
  label: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const on = active ?? pinned;
  const toggle = (id: string) => setPinned((p) => (p === id ? null : id));
  const hover = (id: string | null) => () => setActive(id);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-14">
      <figure className="m-0">
        <div className="instrument rounded-lg p-3 sm:p-5">
          <div className="relative" style={{ aspectRatio: String(ratio) }}>
            {drawing}
            {/* the part being described, outlined */}
            {notes.map((n) => (
              <span
                key={n.id}
                aria-hidden
                className={cn(
                  "pointer-events-none absolute border-2 border-buoy transition-opacity duration-200 motion-reduce:transition-none",
                  n.region.round ? "rounded-full" : "rounded-md",
                  on === n.id ? "opacity-100" : "opacity-0"
                )}
                style={{ left: `${n.region.x}%`, top: `${n.region.y}%`, width: `${n.region.w}%`, height: `${n.region.h}%` }}
              />
            ))}
            {notes.map((n, i) => (
              <button
                key={n.id}
                type="button"
                aria-label={`${i + 1}: ${n.label}`}
                aria-pressed={pinned === n.id}
                onPointerEnter={hover(n.id)}
                onPointerLeave={hover(null)}
                onFocus={hover(n.id)}
                onBlur={hover(null)}
                onClick={() => toggle(n.id)}
                className={cn(
                  "absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-[background-color,color,transform] duration-200 motion-reduce:transition-none sm:size-9",
                  on === n.id ? "scale-110 bg-buoy text-buoy-ink" : "bg-foreground text-background hover:bg-buoy hover:text-buoy-ink"
                )}
                style={{ left: `${n.at.x}%`, top: `${n.at.y}%` }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
        <figcaption className="mt-3 text-sm text-muted-foreground">{caption}</figcaption>
      </figure>

      <ol aria-label={label} className="divide-y divide-line border-y border-line">
        {notes.map((n, i) => (
          <li key={n.id}>
            <button
              type="button"
              aria-pressed={pinned === n.id}
              onPointerEnter={hover(n.id)}
              onPointerLeave={hover(null)}
              onFocus={hover(n.id)}
              onBlur={hover(null)}
              onClick={() => toggle(n.id)}
              className={cn(
                "grid w-full grid-cols-[2rem_1fr] gap-3 py-4 text-left transition-colors duration-200",
                on === n.id && "bg-foreground/[0.04]"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-colors duration-200",
                  on === n.id ? "bg-buoy text-buoy-ink" : "bg-foreground/10 text-foreground"
                )}
              >
                {i + 1}
              </span>
              <span>
                <span className="block font-semibold">{n.label}</span>
                <span className="mt-1 block text-[0.9375rem] leading-relaxed text-muted-foreground">{n.body}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
