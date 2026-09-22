# RowTech

The RowTech site: the marketing page and beta funnel at `/`, and the beta
dashboard at `/app`. Next.js (App Router) + Tailwind + Supabase, on Vercel.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build && npm start
npm run lint
npx playwright test
```

## Environment

Copy `.env.example` to `.env.local`.

| Variable | What it does |
|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Supabase project `rowtech`. Server-side only. The publishable key can insert into `beta_signups` and, for a signed-in user, read what RLS allows. |
| `SITE_URL` | Absolute site URL, for Open Graph tags and auth redirects. Optional on Vercel. |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Product analytics. **No project exists yet.** With the key unset, `posthog-js` is never downloaded and no events are sent. |
| `BETA_DRY_RUN` | `1` makes the beta form validate and confirm without writing to Supabase. Used by the Playwright tests; never set it in production. |

## Layout

| Path | What's there |
|---|---|
| `app/page.tsx` | The marketing page. Server components; interactive blocks are islands (`components/site/islands.tsx`). |
| `app/beta` | The application form, its server action and the shared field definitions. |
| `app/app` | The dashboard. `(dash)` is gated; `login` is not. |
| `lib/stroke.ts`, `lib/stroke-detector.ts`, `lib/live-screen.ts` | The node's own maths and its LIVE screen, in the browser: the marketing page's numbers are computed, not typed in. |
| `supabase/migrations` | Applied to the `rowtech` project. |
| `PERF.md` | Lighthouse baselines, targets, and what this machine's floor is. |

## Supabase

Schema changes go in `supabase/migrations`, named for the version Supabase
records. `beta_signups` holds beta applications (it predates the revamp and
was extended, not replaced).

### Dashboard access

`/app` is open to emails in `public.allowed_users`. Anyone else who signs in
gets the "request beta access" page. To let someone in:

```sql
insert into public.allowed_users (email, note)
values ('lower-case@example.com', 'Club, joined Sept')
on conflict (email) do nothing;
```

### Auth setup, still to do in the Supabase dashboard

These can't be set from migrations:

1. **Google provider** — Authentication → Providers → Google: add the Google
   OAuth client ID and secret. Magic links work without this; the "Continue
   with Google" button will fail until it's done.
2. **Redirect URLs** — Authentication → URL Configuration: set Site URL to the
   production domain, and add `https://<domain>/auth/callback` plus
   `http://localhost:3000/auth/callback` to the allow list.
