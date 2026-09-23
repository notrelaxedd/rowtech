-- Room for a Vieve (cox box) session: a crew session with a GPS track, and
-- the seat sessions it owns. The hub's file format isn't final, so nothing
-- here assumes one: these are the things Vieve is specified to record.

-- How a session's times are kept. Seat nodes have no clock ('boot_ms', the
-- default); Vieve stamps the crew with GPS UTC and keeps every seat on one
-- clock, which is what makes cross-seat timing meaningful.
alter table public.sessions
  add column if not exists clock_source text not null default 'boot_ms'
    check (clock_source in ('boot_ms','gps')),
  -- The hub's own worst-case sync across the crew, in ms (Vieve targets 5).
  add column if not exists clock_sync_ms real check (clock_sync_ms >= 0);

comment on column public.sessions.clock_source is
  'boot_ms: times are ms since that node booted, so they cannot be compared between seats. gps: Vieve put every seat on one clock.';

-- The 10 Hz track. One row per fix, on the crew session.
create table public.gps_points (
  session_id  uuid not null references public.sessions (id) on delete cascade,
  t_ms        bigint not null,
  lat         double precision not null check (lat between -90 and 90),
  lon         double precision not null check (lon between -180 and 180),
  speed_mps   real,
  heading_deg real check (heading_deg >= 0 and heading_deg < 360),
  sats        smallint,
  primary key (session_id, t_ms)
);

alter table public.gps_points enable row level security;

create policy "members read" on public.gps_points for select to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and public.is_team_member(s.team_id)));
create policy "members write" on public.gps_points for insert to authenticated
  with check (exists (select 1 from public.sessions s where s.id = session_id and public.is_team_member(s.team_id)));
create policy "members delete" on public.gps_points for delete to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and public.is_team_member(s.team_id)));
