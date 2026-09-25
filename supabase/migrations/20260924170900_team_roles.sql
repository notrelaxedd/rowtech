-- SEC-020: team_members.role (owner / coach / member) was decorative. No
-- policy read it, nobody could leave a team or be removed from one, a team
-- couldn't be deleted, and any member could delete any session or boat.
--
-- Now: an owner can delete the team and remove members; anyone can leave;
-- deleting sessions and boats is for owners and coaches. (Storage deletes stay
-- open to members: an upload removes its own files again if its rows fail.)

-- Security definer for the same reason as is_team_member: a policy on
-- team_members can't query team_members through its own policies.
create or replace function private.has_team_role(team uuid, roles text[])
returns boolean language sql stable security definer set search_path = '' as $fn$
  select public.is_beta_user() and exists (
    select 1 from public.team_members m
    where m.team_id = team and m.user_id = (select auth.uid()) and m.role = any (roles)
  );
$fn$;
revoke all on function private.has_team_role(uuid, text[]) from public, anon;
grant execute on function private.has_team_role(uuid, text[]) to authenticated;

create policy "owners delete" on public.teams for delete to authenticated
  using (private.has_team_role(id, array['owner']));

create policy "leave, or owners remove" on public.team_members for delete to authenticated
  using (user_id = (select auth.uid()) or private.has_team_role(team_id, array['owner']));

drop policy "members delete" on public.sessions;
create policy "coaches delete" on public.sessions for delete to authenticated
  using (private.has_team_role(team_id, array['owner', 'coach']));

drop policy "members delete" on public.boats;
create policy "coaches delete" on public.boats for delete to authenticated
  using (private.has_team_role(team_id, array['owner', 'coach']));
