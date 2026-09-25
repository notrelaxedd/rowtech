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
npx supabase start   # Docker; applies supabase/migrations, then supabase/seed.sql
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_PUBLISHABLE_KEY=<publishable key from supabase start> \
SUPABASE_SECRET_KEY=<secret key from supabase start> \
npx playwright test
```

Without those three variables they are skipped. They refuse any
`SUPABASE_URL` that isn't this machine (`TEST_SUPABASE_ALLOW_REMOTE=1` allows
a throwaway Supabase branch database). `SUPABASE_SECRET_KEY` is for the tests
only: the app never reads it, and it must never be set on Vercel.

`supabase/config.toml` sets up the local stack: sign-ups off, as they should
be on the `rowtech` project (see "Auth setup" below), and redirects allowed
back to ports 3000 and 3210. Emails Auth sends land in Mailpit,
http://127.0.0.1:54324.

GitHub Actions (`.github/workflows/ci.yml`) runs lint, the type check and the
whole Playwright suite against a local stack on every pull request and every
push to `main`.

### Open-source licenses

`/licenses` lists the open-source packages the site uses, and
`/licenses.txt` carries their license and notice files (the minified bundles
drop them). Both come from `lib/licenses.json` and `public/licenses.txt`,
which `scripts/licenses.mjs` writes from `package-lock.json` and
`node_modules`. After adding, removing or updating a dependency, run
`npm install`, then:

```bash
npm run licenses              # rewrites both files; commit them
npm run licenses -- --check   # what CI runs: fails if they're out of date
```

The list is `dependencies` and everything they pull in, plus each package
`app/globals.css` imports (`tailwindcss` and `shadcn` are `devDependencies`,
but CSS from them ends up in the served stylesheet; only the package itself,
not its own dependencies). Other `devDependencies` aren't listed.
Platform-specific builds (Next's compiler, sharp's image library) are left
out: they run only on the build and server machines, and which ones npm
installs depends on the machine.

## Environment

Copy `.env.example` to `.env.local`.

| Variable | What it does |
|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Supabase project `rowtech`. Server-side only. The publishable key can insert into `beta_signups` and, for a signed-in user, read what RLS allows. |
| `SITE_URL` | Absolute site URL, for Open Graph tags and the sign-in redirect (magic links and Google come back to `SITE_URL/auth/callback`). On Vercel it falls back to the production domain; set it for production anyway. Locally it defaults to `http://localhost:3000`. |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Product analytics. **No project exists yet.** With the key unset, `posthog-js` is never downloaded and no events are sent. |
| `BETA_DRY_RUN` | `1` makes the beta form validate and confirm without writing to Supabase. Used by the Playwright tests; never set it in production (there it is ignored, with an error in the function logs). |

## Layout

| Path | What's there |
|---|---|
| `app/page.tsx` | The marketing page. Server components; interactive blocks are islands (`components/site/islands.tsx`). |
| `app/beta` | The application form, its server action and the shared field definitions. |
| `app/app` | The dashboard. `(dash)` is gated; `login` is not. |
| `lib/stroke.ts` | The node's own maths, in the browser: the marketing page's numbers are computed, not typed in. |
| `components/device` | Force and Vieve, drawn as SVG in the site's colours (after "Vieve V1 + Force, concept A"): the devices, their screens, and the animator that runs the hero's screen. |
| `supabase/migrations` | Applied to the `rowtech` project. |
| `PERF.md` | Lighthouse baselines, targets, and what this machine's floor is. |

## Supabase

Schema changes go in `supabase/migrations`, named for the version Supabase
records. `beta_signups` holds beta applications (it predates the revamp and
was extended, not replaced).

After a schema change, apply it to the local stack and run `npm run db:types`:
it rewrites `lib/supabase/database.types.ts` from the local database, and the
type checker holds every query to it. Don't edit that file by hand.

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

Each user's first upload makes their own team, with them as `owner`. To add
someone to an existing team (after the two steps above), in the SQL editor:

```sql
insert into public.team_members (team_id, user_id, role)
select t.id, u.id, 'coach'   -- or 'member': can't delete sessions or boats
from public.teams t, auth.users u
where t.created_by = (select id from auth.users where email = 'owner@example.com')
  and u.email = 'new-coach@example.com';
```

Owners can delete the team and remove members; owners and coaches can delete
sessions and boats; anyone can leave.

### Auth setup, still to do in the Supabase dashboard and Google Cloud Console

These can't be set from migrations:

1. **Google provider** — Authentication → Providers → Google: add the Google
   OAuth client ID and secret. Magic links work without this. The sign-in page
   hides "Continue with Google" until it's done: then set `googleSignIn` to
   `true` in `lib/owner.ts`, which also adds Google to `/privacy`.
2. **Redirect URLs** — Authentication → URL Configuration: set Site URL to the
   production domain, and add `https://<domain>/auth/callback` plus
   `http://localhost:3000/auth/callback` to the allow list.
3. **No self sign-up** — Authentication → Sign In / Providers: turn off
   "Allow new users to sign up". The app never creates accounts; this stops
   Google sign-in and the Auth API from creating them too.
4. **Google consent screen** — in the Google Cloud Console, on the OAuth
   consent screen for that client: set the app home page to
   `https://<domain>/`, the privacy policy link to `https://<domain>/privacy`
   and the terms of service link to `https://<domain>/terms`, then submit
   the app for verification.
