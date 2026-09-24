-- CODE-001: the upload upserts on (team_id, device_id, session_uuid), but the
-- only unique index on those columns was partial, and Postgres can't use a
-- partial index as an ON CONFLICT arbiter unless the statement repeats its
-- WHERE clause (PostgREST never does). Every seat-session insert failed with
-- 42P10. A plain unique constraint behaves the same for node sessions, and
-- crew sessions (null device_id / session_uuid) still coexist because nulls
-- are distinct.
drop index public.sessions_device_uuid_idx;
alter table public.sessions
  add constraint sessions_device_uuid_key unique (team_id, device_id, session_uuid);
