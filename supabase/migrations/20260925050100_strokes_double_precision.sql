-- CODE-030: peak, impulse, rise_rate and the thirds were real (float4), about
-- seven significant digits, so a raw count like 123456.7891 came back as
-- 123456.79 and Export CSV no longer matched the node's strokes.csv. They are
-- double precision now, and ingest_sessions reads them as such; the rest of
-- it is as 20260924170300_ingest_sessions.sql has it. Strokes stored before
-- this keep the digits real kept; uploading the session again restores them.
alter table public.strokes
  alter column peak      type double precision,
  alter column impulse   type double precision,
  alter column rise_rate type double precision,
  alter column third1    type double precision,
  alter column third2    type double precision,
  alter column third3    type double precision;

create or replace function public.ingest_sessions(
  p_team        uuid,
  p_boat_name   text,
  p_title       text,
  p_recorded_at timestamptz,
  p_seats       jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $fn$
declare
  n        int := jsonb_array_length(p_seats);
  v_uid    uuid := (select auth.uid());
  v_boat   uuid;
  v_parent uuid;
  v_old    uuid[];
  v_seat   jsonb;
  v_id     uuid;
  v_ids    uuid[] := '{}';
begin
  if n is null or n = 0 then
    raise exception 'no sessions to ingest' using errcode = '22023';
  end if;

  -- The boat is named at upload: the node's meta.json doesn't record one.
  if nullif(p_boat_name, '') is not null then
    insert into public.boats (team_id, name) values (p_team, p_boat_name)
      on conflict (team_id, name) do nothing;
    select b.id into v_boat from public.boats b where b.team_id = p_team and b.name = p_boat_name;
  end if;

  -- Crews these seats already belong to, the one holding most of them first.
  select coalesce(array_agg(x.parent_id order by x.seats desc, x.parent_id), '{}')
    into v_old
    from (
      select s.parent_id, count(*) as seats
        from public.sessions s
        join jsonb_array_elements(p_seats) e
          on s.team_id = p_team
         and s.device_id = e->>'device_id'
         and s.session_uuid = e->>'session_uuid'
       where s.parent_id is not null
       group by s.parent_id
    ) x;

  -- Several seats in one upload become a crew session that owns them. A seat
  -- uploaded on its own stays in the crew it came in with, if any.
  v_parent := v_old[1];
  if n > 1 then
    if v_parent is null then
      insert into public.sessions (team_id, kind, boat_id, title, recorded_at, created_by)
      values (p_team, 'crew', v_boat, coalesce(nullif(p_title, ''), n || ' seats'), p_recorded_at, v_uid)
      returning id into v_parent;
    else
      update public.sessions
         set boat_id = v_boat,
             recorded_at = p_recorded_at,
             title = coalesce(nullif(p_title, ''), title)
       where id = v_parent;
    end if;
  end if;

  for v_seat in select * from jsonb_array_elements(p_seats) loop
    insert into public.sessions as s (
      id, team_id, kind, parent_id, boat_id, seat_number, title, recorded_at,
      device_id, session_uuid, format, units, sample_rate, curve_points,
      curve_scale, stroke_count, duration_ms, meta, created_by
    ) values (
      (v_seat->>'id')::uuid, p_team, 'node', v_parent, v_boat,
      (v_seat->>'seat_number')::smallint, nullif(p_title, ''), p_recorded_at,
      v_seat->>'device_id', v_seat->>'session_uuid', (v_seat->>'format')::smallint,
      v_seat->>'units', (v_seat->>'sample_rate')::real, (v_seat->>'curve_points')::smallint,
      (v_seat->>'curve_scale')::integer, jsonb_array_length(v_seat->'strokes'),
      (v_seat->>'duration_ms')::integer, v_seat->'meta', v_uid
    )
    on conflict (team_id, device_id, session_uuid) do update set
      parent_id    = excluded.parent_id,
      boat_id      = excluded.boat_id,
      seat_number  = excluded.seat_number,
      title        = excluded.title,
      recorded_at  = excluded.recorded_at,
      format       = excluded.format,
      units        = excluded.units,
      sample_rate  = excluded.sample_rate,
      curve_points = excluded.curve_points,
      curve_scale  = excluded.curve_scale,
      stroke_count = excluded.stroke_count,
      duration_ms  = excluded.duration_ms,
      meta         = excluded.meta
    returning s.id into v_id;

    -- The files are already stored under the id the app chose. If another
    -- upload of the same session landed in between, they are in the wrong
    -- folder: fail, and let the app clean up.
    if v_id <> (v_seat->>'id')::uuid then
      raise exception 'session % was saved by another upload meanwhile', v_seat->>'session_uuid'
        using errcode = '40001';
    end if;

    -- Re-uploading the same session replaces its strokes rather than doubling them.
    delete from public.strokes where session_id = v_id;
    insert into public.strokes (
      session_id, rec, seq, catch_ms, drive_ms, recovery_ms, peak, peak_pos_pct,
      impulse, rise_rate, third1, third2, third3, curve_valid
    )
    select v_id, (r->>0)::integer, (r->>1)::bigint, (r->>2)::bigint, (r->>3)::integer,
           (r->>4)::integer, (r->>5)::double precision, (r->>6)::smallint, (r->>7)::double precision,
           (r->>8)::double precision, (r->>9)::double precision, (r->>10)::double precision, (r->>11)::double precision,
           (r->>12)::boolean
      from jsonb_array_elements(v_seat->'strokes') r;

    insert into public.session_files (session_id, kind, path, bytes)
    select v_id, f.kind::public.file_kind, f.path, f.bytes
      from jsonb_to_recordset(v_seat->'files') as f(kind text, path text, bytes integer)
    on conflict (session_id, kind) do update set path = excluded.path, bytes = excluded.bytes;

    v_ids := v_ids || v_id;
  end loop;

  -- Crews whose seats all moved to this one have nothing left in them.
  delete from public.sessions p
   where p.id = any (v_old)
     and p.id is distinct from v_parent
     and p.kind = 'crew'
     and not exists (select 1 from public.sessions c where c.parent_id = p.id);

  return jsonb_build_object('parent', v_parent, 'sessions', to_jsonb(v_ids));
end;
$fn$;

revoke all on function public.ingest_sessions(uuid, text, text, timestamptz, jsonb) from public, anon;
grant execute on function public.ingest_sessions(uuid, text, text, timestamptz, jsonb) to authenticated;
