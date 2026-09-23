-- The shared data model for the dashboard: teams own boats and sessions; a
-- session is one node's recording (kind='node') or a crew recording from
-- Vieve (kind='crew') that owns the seat sessions beneath it.
--
-- Stroke rows are small and queryable. Force curves are not: they stay in the
-- firmware's own curves.bin (128 bytes a stroke) in Storage, referenced from
-- session_files, and are sliced client-side.

create type public.boat_class as enum ('1x','2x','2-','2+','4x','4-','4+','8+');
create type public.session_kind as enum ('node','crew');
create type public.seat_side as enum ('port','starboard','scull','cox');
create type public.file_kind as enum ('strokes','curves','events','meta','gps','raw');

create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 120),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id    uuid not null references public.teams (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'coach' check (role in ('owner','coach','member')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on public.team_members (user_id);

-- Membership check for every policy below. Security definer so a policy on
-- team_members can use it without recursing into its own policy.
create or replace function public.is_team_member(team uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select exists (
    select 1 from public.team_members m
    where m.team_id = team and m.user_id = (select auth.uid())
  );
$fn$;
revoke all on function public.is_team_member(uuid) from public, anon;
grant execute on function public.is_team_member(uuid) to authenticated;

create table public.boats (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  class      public.boat_class,
  created_at timestamptz not null default now(),
  unique (team_id, name)
);
create index boats_team_idx on public.boats (team_id);

create table public.seats (
  id          uuid primary key default gen_random_uuid(),
  boat_id     uuid not null references public.boats (id) on delete cascade,
  seat_number smallint not null check (seat_number between 0 and 8),  -- 0 = cox
  side        public.seat_side,
  label       text check (char_length(label) <= 60),
  unique (boat_id, seat_number)
);

create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  kind         public.session_kind not null default 'node',
  -- A crew session (Vieve) owns one node session per seat.
  parent_id    uuid references public.sessions (id) on delete cascade,
  boat_id      uuid references public.boats (id) on delete set null,
  seat_number  smallint check (seat_number between 0 and 8),
  title        text check (char_length(title) <= 120),
  -- The node has no clock, so this is given at upload (or by Vieve's GPS).
  recorded_at  timestamptz not null default now(),
  -- Straight from meta.json.
  device_id    text check (char_length(device_id) <= 64),
  session_uuid text check (char_length(session_uuid) <= 64),
  format       smallint,
  units        text check (char_length(units) <= 12),
  sample_rate  real,
  curve_points smallint,
  curve_scale  integer,
  stroke_count integer not null default 0,
  duration_ms  integer,
  meta         jsonb,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
-- Ingest is idempotent: the same node session can't land twice.
create unique index sessions_device_uuid_idx
  on public.sessions (team_id, device_id, session_uuid)
  where device_id is not null and session_uuid is not null;
create index sessions_team_time_idx on public.sessions (team_id, recorded_at desc);
create index sessions_parent_idx on public.sessions (parent_id);

create table public.session_files (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  kind       public.file_kind not null,
  path       text not null check (char_length(path) <= 400),   -- object in the 'sessions' bucket
  bytes      integer,
  created_at timestamptz not null default now(),
  unique (session_id, kind)
);

create table public.strokes (
  session_id   uuid not null references public.sessions (id) on delete cascade,
  rec          integer not null,               -- record number: offset rec*128 in curves.bin
  seq          bigint not null,
  catch_ms     bigint not null,                -- ms since the node booted
  drive_ms     integer not null,
  recovery_ms  integer not null,
  peak         real not null,                  -- kg, or raw counts when uncalibrated
  peak_pos_pct smallint not null,
  impulse      real not null,
  rise_rate    real not null,
  third1       real not null,
  third2       real not null,
  third3       real not null,
  curve_valid  boolean not null default false,
  primary key (session_id, rec)
);

alter table public.teams         enable row level security;
alter table public.team_members  enable row level security;
alter table public.boats         enable row level security;
alter table public.seats         enable row level security;
alter table public.sessions      enable row level security;
alter table public.session_files enable row level security;
alter table public.strokes       enable row level security;

-- Every policy says the same thing: you can reach a row if you are in its
-- team, and only beta users can create anything.
create policy "members read"   on public.teams for select to authenticated using (public.is_team_member(id));
create policy "beta creates"   on public.teams for insert to authenticated with check (public.is_beta_user() and created_by = (select auth.uid()));
create policy "members update" on public.teams for update to authenticated using (public.is_team_member(id)) with check (public.is_team_member(id));

create policy "members read"   on public.team_members for select to authenticated using (public.is_team_member(team_id));
create policy "join own team"  on public.team_members for insert to authenticated with check (public.is_beta_user() and user_id = (select auth.uid()));

create policy "members read"   on public.boats for select to authenticated using (public.is_team_member(team_id));
create policy "members write"  on public.boats for insert to authenticated with check (public.is_team_member(team_id));
create policy "members update" on public.boats for update to authenticated using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy "members delete" on public.boats for delete to authenticated using (public.is_team_member(team_id));

create policy "members read"   on public.seats for select to authenticated using (exists (select 1 from public.boats b where b.id = boat_id and public.is_team_member(b.team_id)));
create policy "members write"  on public.seats for insert to authenticated with check (exists (select 1 from public.boats b where b.id = boat_id and public.is_team_member(b.team_id)));
create policy "members update" on public.seats for update to authenticated using (exists (select 1 from public.boats b where b.id = boat_id and public.is_team_member(b.team_id))) with check (exists (select 1 from public.boats b where b.id = boat_id and public.is_team_member(b.team_id)));
create policy "members delete" on public.seats for delete to authenticated using (exists (select 1 from public.boats b where b.id = boat_id and public.is_team_member(b.team_id)));

create policy "members read"   on public.sessions for select to authenticated using (public.is_team_member(team_id));
create policy "members write"  on public.sessions for insert to authenticated with check (public.is_team_member(team_id));
create policy "members update" on public.sessions for update to authenticated using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy "members delete" on public.sessions for delete to authenticated using (public.is_team_member(team_id));

create policy "members read"   on public.session_files for select to authenticated using (exists (select 1 from public.sessions s where s.id = session_id and public.is_team_member(s.team_id)));
create policy "members write"  on public.session_files for insert to authenticated with check (exists (select 1 from public.sessions s where s.id = session_id and public.is_team_member(s.team_id)));
create policy "members delete" on public.session_files for delete to authenticated using (exists (select 1 from public.sessions s where s.id = session_id and public.is_team_member(s.team_id)));

create policy "members read"   on public.strokes for select to authenticated using (exists (select 1 from public.sessions s where s.id = session_id and public.is_team_member(s.team_id)));
create policy "members write"  on public.strokes for insert to authenticated with check (exists (select 1 from public.sessions s where s.id = session_id and public.is_team_member(s.team_id)));
create policy "members delete" on public.strokes for delete to authenticated using (exists (select 1 from public.sessions s where s.id = session_id and public.is_team_member(s.team_id)));

-- Session files live in a private bucket, one folder per team.
insert into storage.buckets (id, name, public, file_size_limit)
values ('sessions', 'sessions', false, 52428800)
on conflict (id) do nothing;

create policy "team reads session files" on storage.objects for select to authenticated
  using (bucket_id = 'sessions' and public.is_team_member(((storage.foldername(name))[1])::uuid));
create policy "team writes session files" on storage.objects for insert to authenticated
  with check (bucket_id = 'sessions' and public.is_team_member(((storage.foldername(name))[1])::uuid));
create policy "team deletes session files" on storage.objects for delete to authenticated
  using (bucket_id = 'sessions' and public.is_team_member(((storage.foldername(name))[1])::uuid));
