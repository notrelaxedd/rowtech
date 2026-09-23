"use client";

import { useEffect, useState } from "react";
import { parseMeta, parseStrokes } from "@/lib/session/parse";
import { SessionFormatError } from "@/lib/session/format";
import { SessionViewer, type SeatSource } from "./session-viewer";

// The bundled sample session (public/demo, built by
// scripts/make-demo-session.mjs). Fetched and parsed in the browser by the
// same parser the dashboard uses on real uploads -- nothing is pre-chewed.
const SEATS = [1, 2, 3, 4, 5, 6, 7, 8];
const NAMES: Record<number, string> = { 1: "bow", 8: "stroke" };

export function DemoSession() {
  const [seats, setSeats] = useState<SeatSource[] | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await Promise.all(
        SEATS.map(async (n) => {
          const base = `/demo/seat-${n}`;
          const [metaText, strokesText] = await Promise.all([
            fetch(`${base}/meta.json`).then((r) => r.text()),
            fetch(`${base}/strokes.csv`).then((r) => r.text()),
          ]);
          const meta = parseMeta(metaText);
          return {
            id: `seat-${n}`,
            seat: meta.seat,
            label: NAMES[n] ? `${n} ${NAMES[n]}` : String(n),
            units: meta.units,
            strokes: parseStrokes(strokesText),
            curvesUrl: `${base}/curves.bin`,
          } satisfies SeatSource;
        })
      );
      if (!cancelled) setSeats(loaded);
    })().catch((e: unknown) => {
      if (cancelled) return;
      setError(e instanceof SessionFormatError ? e.message : "The sample session couldn't be loaded.");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!seats) {
    return (
      <div className="min-h-[46rem] animate-pulse rounded-lg border border-line bg-panel motion-reduce:animate-none" aria-busy>
        <span className="sr-only">Loading the sample session…</span>
      </div>
    );
  }
  return <SessionViewer seats={seats} title="Sample session" />;
}
