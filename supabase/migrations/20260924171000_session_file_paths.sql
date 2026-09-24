-- SEC-025: a member could write a session_files row whose path pointed into
-- another team's Storage folder. Storage's own policies kept that from
-- reading or deleting anything, but the row was still wrong. A file row's
-- path must now start with its session's team folder.
drop policy "members write" on public.session_files;
create policy "members write" on public.session_files for insert to authenticated
  with check (exists (
    select 1 from public.sessions s
    where s.id = session_id and public.is_team_member(s.team_id) and split_part(path, '/', 1) = s.team_id::text
  ));

drop policy "members update" on public.session_files;
create policy "members update" on public.session_files for update to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and public.is_team_member(s.team_id)))
  with check (exists (
    select 1 from public.sessions s
    where s.id = session_id and public.is_team_member(s.team_id) and split_part(path, '/', 1) = s.team_id::text
  ));
