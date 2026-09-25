-- SEC-004: every read, update and delete policy asks is_team_member() alone,
-- so taking someone off allowed_users (README's way to remove a user) only
-- took the dashboard away: their team membership still let them read, change
-- and delete the team's data through the API. Membership now counts only
-- while the user is on the beta list, so removing them there is enough.
create or replace function public.is_team_member(team uuid)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select public.is_beta_user() and exists (
    select 1 from public.team_members m
    where m.team_id = team and m.user_id = (select auth.uid())
  );
$fn$;
