-- Local only: `supabase start` and `supabase db reset` run this after the
-- migrations. Never run it against the rowtech project.
--
-- One address on the beta list, so a local account made with it can use
-- /app. Sign-ups are off (config.toml), so make the account in the local
-- Studio (Authentication -> Add user) and sign in with a magic link: it lands
-- in Mailpit, http://127.0.0.1:54324.
insert into public.allowed_users (email, note)
values ('dev@example.com', 'Local development')
on conflict (email) do nothing;
