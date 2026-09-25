-- LEAD-003: the Performance Advisor's findings.
-- Foreign keys without an index (teams.created_by is already covered by
-- teams_created_by_key).
create index if not exists sessions_boat_idx on public.sessions (boat_id);
create index if not exists sessions_created_by_idx on public.sessions (created_by);

-- auth.jwt() was evaluated once per row; wrapped in a select it runs once.
drop policy "read own entry" on public.allowed_users;
create policy "read own entry" on public.allowed_users
  for select to authenticated
  using (email = lower((select auth.jwt()) ->> 'email'));
