-- CODE-008 / SEC-021: a user's team was set up with a select, then two
-- inserts. Two first uploads at once (a double-click, two tabs) could each
-- see no team and each make one, splitting the coach's data; nothing capped
-- how many teams a user could create through the API; and the team insert
-- asked for the new row back, which the members-only read policy refused, so
-- the first upload never got a team at all.
--
-- One team per creator, and one function that finds or makes it: safe to run
-- twice at once, and it never needs to read a team it isn't a member of yet.
create unique index teams_created_by_key on public.teams (created_by);

create or replace function public.ensure_own_team(p_name text)
returns uuid
language plpgsql security invoker set search_path = '' as $fn$
declare
  v_uid  uuid := (select auth.uid());
  v_team uuid;
begin
  select m.team_id into v_team
    from public.team_members m
   where m.user_id = v_uid
   order by m.created_at, m.team_id
   limit 1;
  if v_team is not null then
    return v_team;
  end if;

  -- The id is chosen here rather than returned by the insert, and conflicts
  -- are caught rather than handled with ON CONFLICT: both would need the read
  -- policy, and the caller isn't a member until the second insert.
  v_team := gen_random_uuid();
  begin
    insert into public.teams (id, name, created_by) values (v_team, p_name, v_uid);
  exception when unique_violation then
    -- Another first upload by the same user made it a moment ago.
    select t.id into v_team from public.teams t where t.created_by = v_uid;
    if v_team is null then
      raise exception 'no team for this user' using errcode = 'P0002';
    end if;
  end;

  begin
    insert into public.team_members (team_id, user_id, role) values (v_team, v_uid, 'owner');
  exception when unique_violation then
    null;  -- already in it
  end;
  return v_team;
end;
$fn$;

revoke all on function public.ensure_own_team(text) from public, anon;
grant execute on function public.ensure_own_team(text) to authenticated;
