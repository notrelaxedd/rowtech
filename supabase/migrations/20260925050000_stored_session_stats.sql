-- PERF-012: session_stats was a view that grouped every stroke the caller
-- could see, checking the strokes policy on each row, on every visit to
-- /app/force; its limit applied after the grouping, so it bounded nothing.
-- Each session now keeps its own figures, worked out when its strokes are
-- written, and session_stats reads them: one row per session, no strokes.
--
-- They are kept by a trigger on strokes, not only by ingest_sessions: the
-- strokes policies let a member write strokes through the API too. The
-- trigger runs inside the statement that wrote them, so an upload's figures
-- land with its strokes or not at all.
--
-- CODE-031: span_ms took the longest drive, not the last stroke's. It now
-- runs from the first catch to the last release, as summarise() in
-- lib/session/analyse.ts does, and consistency_pct needs three strokes, as
-- there. It is bigint, as catch_ms is: the parser takes any catch_ms, and an
-- int cast here would fail the upload of a file it accepted.
alter table public.sessions
  add column avg_peak         double precision,
  add column avg_impulse      double precision,
  add column avg_rise_rate    double precision,
  add column avg_peak_pos_pct double precision,
  add column avg_drive_ms     double precision,
  add column avg_recovery_ms  double precision,
  add column consistency_pct  double precision,
  add column span_ms          bigint;

-- Works these sessions' figures out again from their strokes. A session with
-- none left has 0 strokes and no figures.
create function private.store_session_stats(p_sessions uuid[])
returns void
language sql security invoker set search_path = '' as $fn$
  update public.sessions s set
    stroke_count     = x.strokes,
    avg_peak         = x.avg_peak,
    avg_impulse      = x.avg_impulse,
    avg_rise_rate    = x.avg_rise_rate,
    avg_peak_pos_pct = x.avg_peak_pos_pct,
    avg_drive_ms     = x.avg_drive_ms,
    avg_recovery_ms  = x.avg_recovery_ms,
    consistency_pct  = x.consistency_pct,
    span_ms          = x.span_ms
  from (
    select t.id,
           count(k.rec)::int                          as strokes,
           avg(k.peak)::double precision              as avg_peak,
           avg(k.impulse)::double precision           as avg_impulse,
           avg(k.rise_rate)::double precision         as avg_rise_rate,
           avg(k.peak_pos_pct)::double precision      as avg_peak_pos_pct,
           avg(k.drive_ms)::double precision          as avg_drive_ms,
           avg(k.recovery_ms)::double precision       as avg_recovery_ms,
           case when count(k.rec) >= 3 and avg(k.impulse) <> 0
                then (stddev_samp(k.impulse) / avg(k.impulse) * 100)::double precision end as consistency_pct,
           (max(k.catch_ms + k.drive_ms) - min(k.catch_ms))                               as span_ms
      from unnest(p_sessions) as t(id)
      left join public.strokes k on k.session_id = t.id
     group by t.id
  ) x
  where s.id = x.id;
$fn$;
revoke all on function private.store_session_stats(uuid[]) from public;

-- Security definer so it can reach private.store_session_stats, which no API
-- role can. It only works figures out for the sessions whose strokes the
-- statement touched, and the strokes policies already decided that the caller
-- may write those.
create function private.strokes_changed()
returns trigger
language plpgsql security definer set search_path = '' as $fn$
declare
  v_ids uuid[];
begin
  if tg_op = 'INSERT' then
    select array_agg(distinct n.session_id) into v_ids from new_rows n;
  elsif tg_op = 'DELETE' then
    select array_agg(distinct o.session_id) into v_ids from old_rows o;
  else
    select array_agg(distinct x.session_id) into v_ids
      from (select o.session_id from old_rows o union select n.session_id from new_rows n) x;
  end if;
  if v_ids is not null then
    -- Another statement writing these sessions' strokes may hold their rows.
    -- Wait for it here, in id order, so the figures below are worked out
    -- after it commits and count its strokes too.
    perform 1 from public.sessions where id = any (v_ids) order by id for no key update;
    perform private.store_session_stats(v_ids);
  end if;
  return null;
end;
$fn$;
revoke all on function private.strokes_changed() from public;

create trigger strokes_inserted after insert on public.strokes
  referencing new table as new_rows for each statement execute function private.strokes_changed();
create trigger strokes_updated after update on public.strokes
  referencing old table as old_rows new table as new_rows for each statement execute function private.strokes_changed();
create trigger strokes_deleted after delete on public.strokes
  referencing old table as old_rows for each statement execute function private.strokes_changed();

-- Sessions already uploaded.
select private.store_session_stats(array(select id from public.sessions));

-- Same columns as before, read off the session row. security_invoker, so the
-- caller's RLS on sessions still applies.
drop view public.session_stats;
create view public.session_stats
with (security_invoker = true) as
select
  s.id           as session_id,
  s.team_id,
  s.boat_id,
  s.parent_id,
  s.seat_number,
  s.recorded_at,
  s.units,
  s.title,
  s.stroke_count as strokes,
  s.avg_peak,
  s.avg_impulse,
  s.avg_rise_rate,
  s.avg_peak_pos_pct,
  s.avg_drive_ms,
  s.avg_recovery_ms,
  s.consistency_pct,
  s.span_ms
from public.sessions s;

-- Read-only, as before (LEAD-002). A view over one table is updatable, so
-- this matters more now.
revoke all on public.session_stats from public, anon, authenticated;
grant select on public.session_stats to authenticated;
