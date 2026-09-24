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

### Signed-in tests

The dashboard tests (upload, crews, seat sides) sign in as a throwaway user
on a **local** Supabase, never the `rowtech` project:

```bash
npx supabase init    # once, if there is no supabase/config.toml yet
npx supabase start   # Docker; applies supabase/migrations
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_PUBLISHABLE_KEY=<publishable key from supabase start> \
SUPABASE_SECRET_KEY=<secret key from supabase start> \
npx playwright test
```

Without those three variables they are skipped. They refuse any
`SUPABASE_URL` that isn't this machine (`TEST_SUPABASE_ALLOW_REMOTE=1` allows
a throwaway Supabase branch database). `SUPABASE_SECRET_KEY` is for the tests
only: the app never reads it, and it must never be set on Vercel.

## Environment

Copy `.env.example` to `.env.local`.

| Variable | What it does |
|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Supabase project `rowtech`. Server-side only. The publishable key can insert into `beta_signups` and, for a signed-in user, read what RLS allows. |
| `SITE_URL` | Absolute site URL, for Open Graph tags and the sign-in redirect (magic links and Google come back to `SITE_URL/auth/callback`). On Vercel it falls back to the production domain; set it for production anyway. Locally it defaults to `http://localhost:3000`. |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Product analytics. **No project exists yet.** With the key unset, `posthog-js` is never downloaded and no events are sent. |
| `BETA_DRY_RUN` | `1` makes the beta form validate and confirm without writing to Supabase. Used by the Playwright tests; never set it in production. |

## Layout

| Path | What's there |
|---|---|
| `app/page.tsx` | The marketing page. Server components; interactive blocks are islands (`components/site/islands.tsx`). |
| `app/beta` | The application form, its server action and the shared field definitions. |
| `app/app` | The dashboard. `(dash)` is gated; `login` is not. |
| `lib/stroke.ts`, `lib/stroke-detector.ts` | The node's own maths, in the browser: the marketing page's numbers are computed, not typed in. |
| `components/device` | Force and Vieve, drawn as SVG in the site's colours (after "Vieve V1 + Force, concept A"): the devices, their screens, and the animator that runs the hero's screen. |
| `supabase/migrations` | Applied to the `rowtech` project. |
| `PERF.md` | Lighthouse baselines, targets, and what this machine's floor is. |

## Supabase

Schema changes go in `supabase/migrations`, named for the version Supabase
records. `beta_signups` holds beta applications (it predates the revamp and
was extended, not replaced).

### Dashboard access

`/app` is open to emails in `public.allowed_users`. Signing in never creates
an account, so letting someone in takes two steps:

1. Put their address on the list:

   ```sql
   insert into public.allowed_users (email, note)
   values ('lower-case@example.com', 'Club, joined Sept')
   on conflict (email) do nothing;
   ```

2. Create their account: Authentication → Users → Add user → Create new user,
   with the same address and **Auto Confirm User** ticked. The password field
   is required there; use a long random one and don't share it (they sign in
   with a magic link or Google).

To take someone out, delete their `allowed_users` row: their team's data is
closed to them at once, even with a live session.

### Auth setup, still to do in the Supabase dashboard

These can't be set from migrations:

1. **Google provider** — Authentication → Providers → Google: add the Google
   OAuth client ID and secret. Magic links work without this; the "Continue
   with Google" button will fail until it's done.
2. **Redirect URLs** — Authentication → URL Configuration: set Site URL to the
   production domain, and add `https://<domain>/auth/callback` plus
   `http://localhost:3000/auth/callback` to the allow list.
3. **No self sign-up** — Authentication → Sign In / Providers: turn off
   "Allow new users to sign up". The app never creates accounts; this stops
   Google sign-in and the Auth API from creating them too.
