-- SEC-015: sessions.meta holds the node's meta.json as uploaded, with no size
-- limit, so anything up to the whole request body could land in the row. A
-- node writes well under 1 kB; the app refuses anything over 64 kB and so
-- does the table.
alter table public.sessions
  add constraint sessions_meta_size_check check (pg_column_size(meta) < 65536);
