import type { TrackPoint } from "@/components/dash/piece-map";

/** Seconds per 500 m at this speed; null when the boat is all but stopped. */
export const splitFromSpeed = (mps: number | null) => (mps && mps > 0.2 ? 500 / mps : null);

/** A split as m:ss.s, or a dash when there isn't one. Rounded to tenths first, so 119.96 s reads 2:00.0, not 1:60.0. */
export function fmtSplit(s: number | null) {
  if (s === null) return "—";
  const t = Math.round(s * 10) / 10;
  return `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
}

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

/**
 * The fix nearest a point on the map. A degree of longitude is shorter than
 * a degree of latitude by cos(latitude), so it is scaled to match first;
 * unscaled, at 45 degrees north an east-west gap counts double.
 */
export function nearestFix(track: TrackPoint[], lon: number, lat: number): TrackPoint | null {
  const k = Math.cos((lat * Math.PI) / 180);
  let nearest: TrackPoint | null = null;
  let best = Infinity;
  for (const p of track) {
    const d = ((p.lon - lon) * k) ** 2 + (p.lat - lat) ** 2;
    if (d < best) {
      best = d;
      nearest = p;
    }
  }
  return nearest;
}
