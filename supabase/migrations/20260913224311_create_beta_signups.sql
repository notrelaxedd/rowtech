create table public.beta_signups (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text not null check (char_length(name) between 1 and 120),
  email        text not null check (char_length(email) <= 254
                                    and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role         text not null check (role in ('athlete', 'coach', 'program', 'other')),
  organization text check (char_length(organization) <= 160),
  seats        text check (seats in ('1', '2', '4', '8', '9+')),
  location     text check (char_length(location) <= 120),
  message      text check (char_length(message) <= 2000),
  source       text check (char_length(source) <= 200)
);

comment on table public.beta_signups is
  'Beta-tester sign-ups from the RowTech site. Written by anon (insert only); read in the dashboard.';

-- One row per address, case-insensitive. A repeat submission is a 23505 the
-- site treats as success, so the form does not reveal who is already listed.
create unique index beta_signups_email_key on public.beta_signups (lower(email));

alter table public.beta_signups enable row level security;

-- Anyone may add a row; nobody outside the service role may read, update or
-- delete one. No select policy exists, so anon reads return nothing.
create policy "anyone can sign up"
  on public.beta_signups for insert
  to anon
  with check (true);

-- Column-level: anon can set only the form fields, never id or created_at.
revoke all on public.beta_signups from anon, authenticated;
grant insert (name, email, role, organization, seats, location, message, source)
  on public.beta_signups to anon;
