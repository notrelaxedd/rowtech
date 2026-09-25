-- PERF-012: a session's figures are kept by the trigger on strokes
-- (20260925050000), but authenticated could still write them straight to the
-- session row through the API, and the history chart and the compare table
-- would show those until the next stroke write. Grants on the whole table
-- override a column's, so insert and update are granted column by column,
-- every column but the figures. stroke_count stays writable: ingest_sessions
-- runs as the caller and sets it, and the trigger sets it again when the
-- strokes land. The trigger is security definer, so it still writes them all.
revoke insert, update on table public.sessions from authenticated;

grant
  insert (id, team_id, kind, parent_id, boat_id, seat_number, title, recorded_at, device_id, session_uuid,
          format, units, sample_rate, curve_points, curve_scale, stroke_count, duration_ms, meta, created_by,
          created_at, clock_source, clock_sync_ms, side),
  update (id, team_id, kind, parent_id, boat_id, seat_number, title, recorded_at, device_id, session_uuid,
          format, units, sample_rate, curve_points, curve_scale, stroke_count, duration_ms, meta, created_by,
          created_at, clock_source, clock_sync_ms, side)
  on table public.sessions to authenticated;
