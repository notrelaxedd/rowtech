-- Beta applications: the revamped /beta form. Extends the existing
-- public.beta_signups (created 20260913224311_create_beta_signups) rather than
-- adding a second table. Additive only; existing rows are untouched.

-- Only name, email and club/program are required now. Club is required by the
-- form, not the table, because rows from the first form may not have one.
alter table public.beta_signups alter column role drop not null;

alter table public.beta_signups
  add column if not exists boat_types   text[],
  add column if not exists from_cta     text,
  add column if not exists utm_source   text,
  add column if not exists utm_medium   text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term     text,
  add column if not exists utm_content  text,
  add column if not exists referrer     text;

alter table public.beta_signups
  add constraint beta_signups_boat_types_check
    check (boat_types <@ array['1x','2x','2-','2+','4x','4-','4+','8+']::text[] and cardinality(boat_types) <= 8),
  add constraint beta_signups_from_cta_check     check (char_length(from_cta) <= 40),
  add constraint beta_signups_utm_source_check   check (char_length(utm_source) <= 100),
  add constraint beta_signups_utm_medium_check   check (char_length(utm_medium) <= 100),
  add constraint beta_signups_utm_campaign_check check (char_length(utm_campaign) <= 100),
  add constraint beta_signups_utm_term_check     check (char_length(utm_term) <= 100),
  add constraint beta_signups_utm_content_check  check (char_length(utm_content) <= 100),
  add constraint beta_signups_referrer_check     check (char_length(referrer) <= 200);

-- The publishable key stays insert-only, column by column.
grant insert (boat_types, from_cta, utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer)
  on public.beta_signups to anon;

comment on column public.beta_signups.from_cta is 'Which call to action sent them: the ?from= value on /beta.';
comment on column public.beta_signups.source is 'Legacy combined attribution string from the first form. New rows use from_cta and utm_*.';
