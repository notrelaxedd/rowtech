import type { TrackPoint } from "@/components/dash/piece-map";

/**
 * The track the page sends to the map: every Nth fix and the last, at most
 * `max` of them, so the page stays small. A 40-minute piece at 10 Hz is
 * 24,000 fixes; thinned to 2,000 it is still a fix every 1.2 s.
 */
export function thinTrack(track: TrackPoint[], max = 2000): TrackPoint[] {
  if (track.length <= max) return track;
  const step = Math.ceil((track.length - 1) / (max - 1));
  const out: TrackPoint[] = [];
  for (let i = 0; i < track.length - 1; i += step) out.push(track[i]);
  out.push(track[track.length - 1]);
  return out;
}
