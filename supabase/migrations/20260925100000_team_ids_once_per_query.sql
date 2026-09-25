-- PERF-012: every policy that asked private.is_team_member(team_id) of a row
-- called that function once per row the query looked at. It's security
-- definer, so the planner can't inline it or use it with an index: the Cox
-- and Force lists, which filter by kind, parent and time but not by team,
-- read every team's sessions and ran the membership check on each one (a
-- seq scan with the function as its filter). Reading a seat's strokes or a
-- GPS track ran it once per stroke or fix, and saving them once per row too;
-- reading a boat's seats ran it on every team's boats.
--
-- The caller's teams are now looked up once per query: private.my_team_ids()
-- returns them, and the policies compare the row's team with that list. The
-- list sits in `= any (array(select ...))`, an init plan run once, and the
-- planner can use the indexes that lead with team_id.
--
-- Same rule as is_team_member: no teams at all unless the caller is on the
-- beta list (SEC-004), so removing them from allowed_users still takes
-- everything away.
--
-- Left as they are: session_files (read and written a few rows at a time, by
-- session id, so the check runs on those rows only; SEC-025's path check
-- stays with it), the Storage policies (every Storage call names its
-- objects, so the check runs on those few rows), and the policies that check
-- something else (SEC-001's join own team, SEC-020's owner and coach roles).

create function private.my_team_ids()
returns setof uuid language sql stable security definer set search_path = '' as $fn$
  select m.team_id from public.team_members m
   where m.user_id = (select auth.uid()) and public.is_beta_user();
$fn$;
-- Policies need EXECUTE on it, not USAGE on the schema (see 20260924171100).
revoke all on function private.my_team_ids() from public, anon;
grant execute on function private.my_team_ids() to authenticated;

-- teams
drop policy "members read" on public.teams;
create policy "members read" on public.teams for select to authenticated
  using (id = any (array(select private.my_team_ids())));

drop policy "members update" on public.teams;
create policy "members update" on public.teams for update to authenticated
  using (id = any (array(select private.my_team_ids())))
  with check (id = any (array(select private.my_team_ids())));

-- team_members
drop policy "members read" on public.team_members;
create policy "members read" on public.team_members for select to authenticated
  using (team_id = any (array(select private.my_team_ids())));

-- boats
drop policy "members read" on public.boats;
create policy "members read" on public.boats for select to authenticated
  using (team_id = any (array(select private.my_team_ids())));

drop policy "members write" on public.boats;
create policy "members write" on public.boats for insert to authenticated
  with check (team_id = any (array(select private.my_team_ids())));

drop policy "members update" on public.boats;
create policy "members update" on public.boats for update to authenticated
  using (team_id = any (array(select private.my_team_ids())))
  with check (team_id = any (array(select private.my_team_ids())));

-- sessions
drop policy "members read" on public.sessions;
create policy "members read" on public.sessions for select to authenticated
  using (team_id = any (array(select private.my_team_ids())));

drop policy "members write" on public.sessions;
create policy "members write" on public.sessions for insert to authenticated
  with check (team_id = any (array(select private.my_team_ids())));

drop policy "members update" on public.sessions;
create policy "members update" on public.sessions for update to authenticated
  using (team_id = any (array(select private.my_team_ids())))
  with check (team_id = any (array(select private.my_team_ids())));

-- seats: the planner hashes the caller's boats for these, which ran the
-- membership check on every team's boats.
drop policy "members read" on public.seats;
create policy "members read" on public.seats for select to authenticated
  using (exists (select 1 from public.boats b
                  where b.id = seats.boat_id and b.team_id = any (array(select private.my_team_ids()))));

drop policy "members write" on public.seats;
create policy "members write" on public.seats for insert to authenticated
  with check (exists (select 1 from public.boats b
                       where b.id = seats.boat_id and b.team_id = any (array(select private.my_team_ids()))));

drop policy "members update" on public.seats;
create policy "members update" on public.seats for update to authenticated
  using (exists (select 1 from public.boats b
                  where b.id = seats.boat_id and b.team_id = any (array(select private.my_team_ids()))))
  with check (exists (select 1 from public.boats b
                       where b.id = seats.boat_id and b.team_id = any (array(select private.my_team_ids()))));

drop policy "members delete" on public.seats;
create policy "members delete" on public.seats for delete to authenticated
  using (exists (select 1 from public.boats b
                  where b.id = seats.boat_id and b.team_id = any (array(select private.my_team_ids()))));

-- strokes and gps_points: a seat has about a thousand of each, read and
-- written together, so their session check goes the same way.
drop policy "members read" on public.strokes;
create policy "members read" on public.strokes for select to authenticated
  using (exists (select 1 from public.sessions s
                  where s.id = strokes.session_id and s.team_id = any (array(select private.my_team_ids()))));

drop policy "members write" on public.strokes;
create policy "members write" on public.strokes for insert to authenticated
  with check (exists (select 1 from public.sessions s
                       where s.id = strokes.session_id and s.team_id = any (array(select private.my_team_ids()))));

drop policy "members delete" on public.strokes;
create policy "members delete" on public.strokes for delete to authenticated
  using (exists (select 1 from public.sessions s
                  where s.id = strokes.session_id and s.team_id = any (array(select private.my_team_ids()))));

drop policy "members read" on public.gps_points;
create policy "members read" on public.gps_points for select to authenticated
  using (exists (select 1 from public.sessions s
                  where s.id = gps_points.session_id and s.team_id = any (array(select private.my_team_ids()))));

drop policy "members write" on public.gps_points;
create policy "members write" on public.gps_points for insert to authenticated
  with check (exists (select 1 from public.sessions s
                       where s.id = gps_points.session_id and s.team_id = any (array(select private.my_team_ids()))));

drop policy "members delete" on public.gps_points;
create policy "members delete" on public.gps_points for delete to authenticated
  using (exists (select 1 from public.sessions s
                  where s.id = gps_points.session_id and s.team_id = any (array(select private.my_team_ids()))));
