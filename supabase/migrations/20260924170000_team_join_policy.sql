-- SEC-001: "join own team" checked only that a beta user was adding
-- themselves, never which team, so any beta user could add themselves to any
-- team (as owner) and reach its sessions, strokes and files. Now a user can
-- only add themselves, as owner, to a team they created. Anyone else joins a
-- team by hand (SQL, as the service role) until there is an invite flow.

-- Helpers that only policies call live here. PostgREST doesn't expose this
-- schema and no API role has USAGE on it, so they can't be called as RPCs;
-- policies still can, with EXECUTE.
create schema if not exists private;
revoke all on schema private from public;

-- Security definer so a policy on team_members can read teams without the
-- teams read policy (members only) hiding the caller's brand-new team.
create or replace function private.created_team(team uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select exists (
    select 1 from public.teams t
    where t.id = team and t.created_by = (select auth.uid())
  );
$fn$;
revoke all on function private.created_team(uuid) from public, anon;
grant execute on function private.created_team(uuid) to authenticated;

drop policy "join own team" on public.team_members;
create policy "join own team" on public.team_members for insert to authenticated
  with check (
    public.is_beta_user()
    and user_id = (select auth.uid())
    and role = 'owner'
    and private.created_team(team_id)
  );
