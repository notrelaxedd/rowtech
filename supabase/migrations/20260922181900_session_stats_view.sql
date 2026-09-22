-- Per-session aggregates, for the history charts. security_invoker so the
-- caller's RLS on sessions and strokes still applies.
create view public.session_stats
with (security_invoker = true) as
select
  s.id                as session_id,
  s.team_id,
  s.boat_id,
  s.parent_id,
  s.seat_number,
  s.recorded_at,
  s.units,
  s.title,
  count(k.rec)::int                               as strokes,
  avg(k.peak)::real                               as avg_peak,
  avg(k.impulse)::real                            as avg_impulse,
  avg(k.rise_rate)::real                          as avg_rise_rate,
  avg(k.peak_pos_pct)::real                       as avg_peak_pos_pct,
  avg(k.drive_ms)::real                           as avg_drive_ms,
  avg(k.recovery_ms)::real                        as avg_recovery_ms,
  case when avg(k.impulse) > 0
       then (stddev_samp(k.impulse) / avg(k.impulse) * 100)::real end as consistency_pct,
  (max(k.catch_ms) + max(k.drive_ms) - min(k.catch_ms))::int          as span_ms
from public.sessions s
left join public.strokes k on k.session_id = s.id
group by s.id;

grant select on public.session_stats to authenticated;
