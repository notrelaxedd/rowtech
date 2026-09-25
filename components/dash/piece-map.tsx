"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { cn } from "@/lib/utils";
import { chip } from "@/components/dash/chip";
import { fmtSplit, nearestFix, splitFromSpeed } from "@/lib/session/track";
import { seatLabel } from "@/lib/session/labels";

export type TrackPoint = {
  tMs: number;
  lat: number;
  lon: number;
  speedMps: number | null;
  headingDeg: number | null;
};

/** Seat forces at a moment, for the hover readout. */
export type SeatForceAt = (tMs: number) => Array<{ seat: number | null; peak: number | null }>;

/** Slow is dark, quick is bright: colour a segment by its split. */
function splitColour(split: number | null, best: number, worst: number): string {
  if (split === null) return "#4a5560";
  const k = Math.max(0, Math.min(1, (worst - split) / (worst - best || 1)));
  // muted blue -> trace cyan
  const r = Math.round(30 + k * 4);
  const g = Math.round(70 + k * 157);
  const b = Math.round(110 + k * 129);
  return `rgb(${r},${g},${b})`;
}

/**
 * The piece on the water, coloured by split. MapLibre loads only when this
 * renders, and the style is plain vector-free canvas: no tile key is needed
 * for the track itself. Heading-up is a toggle, as it is on Vieve.
 */
export function PieceMap({
  track,
  rateAt,
  seatForcesAt,
}: {
  track: TrackPoint[];
  rateAt?: (tMs: number) => number | null;
  seatForcesAt?: SeatForceAt;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [headingUp, setHeadingUp] = useState(false);
  const [hover, setHover] = useState<TrackPoint | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el || track.length < 2) return;
    let disposed = false;

    (async () => {
      const maplibre = await import("maplibre-gl");
      await import("maplibre-gl/dist/maplibre-gl.css");
      if (disposed) return;

      const splits = track.map((p) => splitFromSpeed(p.speedMps)).filter((s): s is number => s !== null);
      const best = splits.length ? Math.min(...splits) : 90;
      const worst = splits.length ? Math.max(...splits) : 150;

      const features = track.slice(1).map((p, i) => {
        const a = track[i];
        const split = splitFromSpeed(p.speedMps);
        return {
          type: "Feature" as const,
          properties: { colour: splitColour(split, best, worst), tMs: p.tMs },
          geometry: { type: "LineString" as const, coordinates: [[a.lon, a.lat], [p.lon, p.lat]] },
        };
      });

      const m = new maplibre.Map({
        container: el,
        style: {
          version: 8,
          sources: {},
          layers: [{ id: "bg", type: "background", paint: { "background-color": "#070b0f" } }],
        },
        center: [track[0].lon, track[0].lat],
        zoom: 15,
        attributionControl: false,
      });
      map.current = m;

      m.on("load", () => {
        if (disposed) return;
        m.addSource("piece", { type: "geojson", data: { type: "FeatureCollection", features } });
        m.addLayer({
          id: "piece-line",
          type: "line",
          source: "piece",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-width": 5, "line-color": ["get", "colour"] },
        });
        const lons = track.map((p) => p.lon);
        const lats = track.map((p) => p.lat);
        const [west, south, east, north] = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
        // A boat that never moved has no box to fit: centre on it instead.
        if (west === east && south === north) m.jumpTo({ center: [west, south], zoom: 15 });
        else m.fitBounds([[west, south], [east, north]], { padding: 40, duration: 0 });
      });

      // Hover the track: the nearest fix wins. The track is thinned to at
      // most 2,000 fixes (thinTrack), so a walk over it is quick enough.
      m.on("mousemove", (e) => setHover(nearestFix(track, e.lngLat.lng, e.lngLat.lat)));
      m.on("mouseout", () => setHover(null));
    })().catch(() => {
      // No map: the readouts below still tell the story.
    });

    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
    };
  }, [track]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const last = track[track.length - 1];
    m.easeTo({ bearing: headingUp ? (last?.headingDeg ?? 0) : 0, duration: 400 });
  }, [headingUp, track]);

  if (track.length < 2) return null;

  const split = hover ? splitFromSpeed(hover.speedMps) : null;
  const forces = hover && seatForcesAt ? seatForcesAt(hover.tMs) : [];

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-panel">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5">
        <p className="readout text-xs text-muted-foreground">
          <span className="text-trace">OUTING</span> · colored by split
        </p>
        <button
          type="button"
          aria-pressed={headingUp}
          onClick={() => setHeadingUp((v) => !v)}
          className={cn(
            chip,
            headingUp ? "border-trace/60 bg-trace/10 text-trace" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Heading up
        </button>
      </div>
      <div ref={host} className="h-[26rem] w-full" />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-line px-4 py-2.5 text-sm">
        {hover ? (
          <>
            <span className="readout">
              split <span className="text-trace">{fmtSplit(split)}</span> /500m
            </span>
            {rateAt && (
              <span className="readout">
                rate <span className="text-trace">{rateAt(hover.tMs)?.toFixed(1) ?? "—"}</span>
              </span>
            )}
            {forces.length > 0 && (
              <span className="readout text-muted-foreground">
                {forces.map((f) => `${f.seat === null ? seatLabel(null) : f.seat}: ${f.peak === null ? "—" : f.peak.toFixed(0)}`).join("  ")}
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">Point at the track to read split, rate and every seat.</span>
        )}
      </div>
    </div>
  );
}
