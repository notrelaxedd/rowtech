-- LEAD-002: Supabase's default privileges gave anon (the publishable key with
-- no session) and authenticated every privilege on every dashboard table, so
-- RLS was the only barrier: one careless policy or a disabled RLS flag would
-- have opened a table to the internet, and TRUNCATE isn't governed by RLS at
-- all. anon needs nothing here; authenticated needs read/write, which RLS
-- then narrows. beta_signups already has its own column-level grants.
revoke all on table
  public.allowed_users, public.teams, public.team_members, public.boats, public.seats,
  public.sessions, public.session_files, public.strokes, public.gps_points, public.session_stats
  from anon;

revoke truncate, references, trigger, maintain on table
  public.allowed_users, public.teams, public.team_members, public.boats, public.seats,
  public.sessions, public.session_files, public.strokes, public.gps_points, public.session_stats
  from authenticated;

-- A view of aggregates: read-only.
revoke insert, update, delete on table public.session_stats from authenticated;

-- Tables created from now on start the same way.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from authenticated;
