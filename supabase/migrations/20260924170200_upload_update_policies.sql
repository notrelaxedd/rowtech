-- CODE-010: re-uploading a session upserts its session_files rows, and an
-- upsert that hits an existing row is an UPDATE. session_files had no UPDATE
-- policy, so that path was always denied (and the app never looked).
create policy "members update" on public.session_files for update to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and public.is_team_member(s.team_id)))
  with check (exists (select 1 from public.sessions s where s.id = session_id and public.is_team_member(s.team_id)));

-- Same gap one layer down: the files themselves are uploaded with upsert, and
-- overwriting an object in Storage needs an UPDATE policy on storage.objects.
-- Without it every re-upload failed at the first file.
create policy "team updates session files" on storage.objects for update to authenticated
  using (bucket_id = 'sessions' and public.is_team_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'sessions' and public.is_team_member(((storage.foldername(name))[1])::uuid));
