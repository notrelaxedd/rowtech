-- LEAD-001: the Security Advisor flags is_team_member() because, as a
-- security definer function in public, any signed-in user could call it
-- through /rest/v1/rpc and probe which teams they belong to. Only policies
-- need it, so it moves to the private schema, which PostgREST doesn't
-- expose. Policies refer to it by oid and keep working unchanged.
-- is_beta_user() stays in public: the app calls it.
alter function public.is_team_member(uuid) set schema private;
