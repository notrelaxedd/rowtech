import "server-only";
import { readFailed, type supabaseServer } from "@/lib/supabase/server";
import type { StrokeRow } from "./format";
import type { TrackPoint } from "@/components/dash/piece-map";

type Db = Awaited<ReturnType<typeof supabaseServer>>;

/** A stroke as session_strokes() sends it: the columns of strokes.csv, in order. */
type StrokeTuple = [number, number, number, number, number, number, number, number, number, number, number, number, boolean];

const toStroke = ([rec, seq, catchMs, driveMs, recoveryMs, peak, peakPosPct, impulse, riseRate, t1, t2, t3, curveValid]: StrokeTuple): StrokeRow => ({
  rec, seq, catchMs, driveMs, recoveryMs, peak, peakPosPct, impulse, riseRate, thirds: [t1, t2, t3], curveValid,
});

/**
 * Every stroke of these seat sessions, in one round trip, by session id. A
 * table read stops at the API's 1,000-row cap; this doesn't
 * (supabase/migrations/*_session_strokes_and_track.sql).
 */
export async function seatStrokes(sb: Db, ids: string[]): Promise<Map<string, StrokeRow[]>> {
  const { data, error } = await sb.rpc("session_strokes", { p_sessions: ids });
  if (error) throw await readFailed(error);
  const bySession = (data ?? {}) as Record<string, StrokeTuple[]>;
  return new Map(ids.map((id) => [id, (bySession[id] ?? []).map(toStroke)]));
}

/** A session's whole GPS track, in time order. */
export async function sessionTrack(sb: Db, id: string): Promise<TrackPoint[]> {
  const { data, error } = await sb.rpc("session_track", { p_session: id });
  if (error) throw await readFailed(error);
  return ((data ?? []) as Array<[number, number, number, number | null, number | null]>).map(([tMs, lat, lon, speedMps, headingDeg]) => ({
    tMs, lat, lon, speedMps, headingDeg,
  }));
}
