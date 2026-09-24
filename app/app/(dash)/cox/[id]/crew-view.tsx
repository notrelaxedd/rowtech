"use client";

import { rateAt } from "@/lib/session/analyse";
import { CrewPanel, type CrewSeat } from "@/components/dash/crew-panel";
import { PieceMap, type TrackPoint } from "@/components/dash/piece-map";
import { setSeatSide } from "../actions";

export function CrewView({
  seats,
  track,
  clockSource,
  clockSyncMs,
}: {
  seats: CrewSeat[];
  track: TrackPoint[];
  clockSource: "boot_ms" | "gps";
  clockSyncMs: number | null;
}) {
  // Stroke rate and seat forces at a moment on the track, for the map readout.
  // Only meaningful once the crew is on one clock -- before that the map has
  // no track anyway, because the track comes from Vieve.
  const stroke = seats[0];
  const indexAt = (tMs: number) => {
    if (!stroke) return -1;
    let i = stroke.strokes.findIndex((s) => s.catchMs > tMs);
    if (i === -1) i = stroke.strokes.length;
    return i - 1;
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="space-y-4">
        {track.length > 1 ? (
          <PieceMap
            track={track}
            rateAt={(tMs) => (stroke ? rateAt(stroke.strokes, indexAt(tMs)) : null)}
            seatForcesAt={(tMs) => {
              const i = indexAt(tMs);
              return seats.map((s) => ({ seat: s.seat, peak: s.strokes[i]?.peak ?? null }));
            }}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-line px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No GPS track on this outing. The track, the split and the race line come from Vieve, the RowTech cox box.
            </p>
          </div>
        )}
      </div>

      <CrewPanel
        seats={seats}
        clockSource={clockSource}
        clockSyncMs={clockSyncMs}
        onSetSide={async (seatId, side) => {
          const saved = await setSeatSide(seatId, side);
          return saved.ok ? null : saved.message;
        }}
      />
    </div>
  );
}
