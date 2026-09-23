-- Dashboard access for beta users. An email is let into /app by adding it
-- here (Supabase dashboard or SQL). Everyone else who signs in is shown the
-- "request beta access" page.
create table public.allowed_users (
  email      text primary key check (email = lower(email) and char_length(email) <= 254),
  note       text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
comment on table public.allowed_users is 'Emails allowed into the /app dashboard. Lower-case. Managed by hand.';

alter table public.allowed_users enable row level security;

-- A signed-in user can see whether their own email is on the list; nothing else.
create policy "read own entry" on public.allowed_users
  for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));

-- The check every other policy leans on.
create or replace function public.is_beta_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.allowed_users a
    where a.email = lower(auth.jwt() ->> 'email')
  );
$$;
revoke all on function public.is_beta_user() from public, anon;
grant execute on function public.is_beta_user() to authenticated;
