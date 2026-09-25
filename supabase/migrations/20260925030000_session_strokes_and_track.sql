-- PERF-009, PERF-010, CODE-029: the session and crew pages read strokes one
-- seat at a time, and every read through the API stops at max_rows (1,000
-- rows), so a seat with 1,500 strokes showed 1,000 and a GPS track stopped
-- after 1,000 fixes. These return every stroke of several seats, or a whole
-- track, as one value: one round trip, and no row cap.
--
-- Security invoker: they run as the caller, so the RLS policies on strokes
-- and gps_points still decide what comes back. Another team's session id
-- returns nothing.
--
-- json rather than jsonb: numbers print the way a table read prints them.

-- Strokes by session id, each an array in the order of strokes.csv:
--   [rec, seq, catch_ms, drive_ms, recovery_ms, peak, peak_pos_pct, impulse,
--    rise_rate, third1, third2, third3, curve_valid]
-- A session with no strokes has no key.
create function public.session_strokes(p_sessions uuid[])
returns json
language sql stable security invoker set search_path = '' as $fn$
  select coalesce(json_object_agg(x.session_id, x.strokes), '{}')
    from (
      select k.session_id,
             json_agg(
               json_build_array(k.rec, k.seq, k.catch_ms, k.drive_ms, k.recovery_ms, k.peak, k.peak_pos_pct,
                                k.impulse, k.rise_rate, k.third1, k.third2, k.third3, k.curve_valid)
               order by k.rec
             ) as strokes
        from public.strokes k
       where k.session_id = any (p_sessions)
       group by k.session_id
    ) x;
$fn$;

-- A session's GPS track in time order, each fix [t_ms, lat, lon, speed_mps, heading_deg].
create function public.session_track(p_session uuid)
returns json
language sql stable security invoker set search_path = '' as $fn$
  select coalesce(json_agg(json_build_array(g.t_ms, g.lat, g.lon, g.speed_mps, g.heading_deg) order by g.t_ms), '[]')
    from public.gps_points g
   where g.session_id = p_session;
$fn$;

revoke all on function public.session_strokes(uuid[]) from public, anon;
revoke all on function public.session_track(uuid) from public, anon;
grant execute on function public.session_strokes(uuid[]) to authenticated;
grant execute on function public.session_track(uuid) to authenticated;
