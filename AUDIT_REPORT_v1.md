# RowTech audit report, v1

- **Date:** 2026-09-24
- **Target:** https://www.rowtech.app (apex `rowtech.app` 308-redirects to `www`) and the repository at `C:\Users\notre\projects\rowtech`, branch `main`, HEAD `aba1b1a` ("site: remove the team page for now"), which is also `origin/main` and the production deployment (`dpl_ERLSPqx3ZFVRNqmPrdxeeDJqJ76Z`, live since 14:58:51 UTC on the audit day).
- **Method:** read-only. No code changes, no commits, no database writes, no deploys. Live checks were GET requests, header inspection and Playwright browsing as an anonymous visitor; the beta form and login form were filled but never submitted. Supabase was queried read-only through the Supabase MCP (advisors, `pg_policies`, `pg_indexes`, grants, migration list, table row counts); Vercel through the Vercel MCP (project, domains, deployments; environment-variable listing was refused with 403). The work was split across six specialist passes (security, legal and content, UX and accessibility, performance and SEO, code quality, business), then a final read of the whole codebase.
- **Status vocabulary:** CONFIRMED = observed in code, schema, headers or the browser. SUSPECTED = a reasoned conclusion that was not exercised. NEEDS MANUAL CHECK = needs credentials, a write, or an external console the audit could not reach.
- **Note on timing:** the first live crawl (14:54 UTC) hit the previous production deployment (`d8cacbc`), where `/team` still returned 200. The `aba1b1a` deployment went live four minutes later; every finding below refers to the current deployment unless it says otherwise.

---

## 1. Stack and surface map

### 1.1 Stack

| Layer | What is used | Evidence |
|---|---|---|
| Framework | Next.js 16.2.3 (App Router, React Server Components, Server Actions, `proxy.ts` instead of middleware), React 19.2.4, TypeScript 5.9 strict | `package.json`, `proxy.ts`, `next.config.ts` |
| Styling / UI | Tailwind v4, `tw-animate-css`, `shadcn` CLI (only for `@import "shadcn/tailwind.css"`), `@base-ui/react` + `class-variance-authority` (imported only by an unused button component), `lucide-react` icons | `app/globals.css:1-3`, `components/ui/button.tsx` |
| 3D / graphics | `three` 0.186, `@react-three/fiber`, `@react-three/drei` for the product-page device models; `maplibre-gl` for the dashboard GPS map (no tile source, blank background) | `components/device3d/scene.tsx`, `components/dash/piece-map.tsx` |
| Hosting | Vercel, project `rowtech` (`prj_PDUVVZ5eFWrDE9Fgde9XZNlhuq4O`), team `notrelaxed11-3656s-projects`, Node 24.x, Git integration from `github.com/notrelaxedd/rowtech`; production domains `www.rowtech.app`, `rowtech.app` (308 to www), `rowtech.vercel.app` (serves the site publicly); preview and branch URLs are SSO-protected (302 to Vercel login) | Vercel MCP `get_project`, `list_project_domains`; curl |
| Database / auth / storage | Supabase project `rowtech` (`vawudwgexkkwpdxiwqhp`, us-east-1, Postgres 17.6). Auth: magic link (`signInWithOtp`, `shouldCreateUser: true`) and Google OAuth (README says the provider is not configured yet). Storage bucket `sessions` (private, 50 MB per object, no MIME allow-list) | `lib/supabase/*.ts`, `app/app/login/actions.ts`, `supabase/migrations/*` |
| Supabase client keys | `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are read server-side only (never `NEXT_PUBLIC_`); no browser code talks to Supabase except via 1-hour signed Storage URLs | `lib/supabase/anon.ts`, `lib/supabase/server.ts`, `proxy.ts` |
| Payments | None. No Stripe or checkout code. Prices on the site are a "$499 target" for Vieve and "Discounted prices" for beta crews | grep |
| AI / LLM | None | grep |
| Email | None. The beta confirmation email is a stub that does nothing (`sendConfirmation`) | `app/beta/actions.ts:33-37` |
| Analytics / third-party scripts | `@vercel/analytics` and `@vercel/speed-insights` load on every page (same-origin scripts, no consent). PostHog is wired (`posthog-js`, `persistence: "localStorage+cookie"`, US host) but no key is set in production, so it never loads (verified in the served chunks). Fonts (Archivo, Chivo Mono) are self-hosted via `next/font`; no third-party hosts appear in any page's HTML | `app/layout.tsx:63-66`, `lib/analytics.ts`, live HTML |
| Tests / tooling | Playwright 1.63 (28 tests, run against a fresh production build on port 3210 with `BETA_DRY_RUN=1`), ESLint 9 flat config, no CI, no `engines`, migrations applied by hand | `playwright.config.ts`, `tests/*.spec.ts`, README |

### 1.2 Routes and pages

| Route | Rendering | Auth | Notes |
|---|---|---|---|
| `/` | prerendered, CDN cached | public | marketing home, 198 kB HTML, JSON-LD Organization |
| `/beta` | dynamic (reads `searchParams.from`) | public | application form; server action `submitApplication` |
| `/force`, `/vieve` | prerendered | public | product pages, 3D diagrams, spec tables, JSON-LD Product on /force |
| `/team` | removed in `aba1b1a` | | now the default Next 404 |
| `/app` | dynamic | signed-in + on `allowed_users` | redirects to `/app/force` |
| `/app/login` | dynamic, `noindex` | public | magic link + Google; server actions `sendMagicLink`, `signInWithGoogle`, `signOut` |
| `/app/force` | dynamic | gated | session list, upload form, history chart |
| `/app/force/[id]` | dynamic | gated | session viewer, per-seat curves via signed URLs |
| `/app/cox`, `/app/cox/[id]`, `/app/cox/compare` | dynamic | gated | crew outings, GPS map, compare two pieces |
| `/auth/callback` (GET) | route handler | public | exchanges the PKCE code, sanitised `next` redirect |
| `/robots.txt`, `/sitemap.xml`, `/privacy`, `/terms`, `/favicon.ico` | | | all 404 |
| `/demo/seat-1..8/*` | static | public | synthetic sample session files, unlinked |
| `/_next/image?url=<same-origin>` | | public | image optimizer enabled, no images used by the site |

### 1.3 Server actions (POST endpoints reachable without the UI)

| Action | File | Check that protects it |
|---|---|---|
| `submitApplication` | `app/beta/actions.ts:40` | honeypot field + server validation; no rate limit or CAPTCHA |
| `sendMagicLink` | `app/app/login/actions.ts:19` | email regex only; Supabase's own rate limits; creates accounts |
| `signInWithGoogle` | `app/app/login/actions.ts:35` | none (redirects to Supabase) |
| `signOut` | `app/app/login/actions.ts:48` | Next's Origin/Host check |
| `uploadSession` | `app/app/(dash)/force/actions.ts:43` | `getViewer().state === "allowed"` + RLS |
| `deleteSession` | `app/app/(dash)/force/actions.ts:210` | RLS only; no UI caller (dead but reachable) |
| `setSeatSide` | `app/app/(dash)/cox/actions.ts:7` | RLS only |

### 1.4 Environment variables referenced

`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (server), `SITE_URL` (metadata base and auth callback origin), `VERCEL_PROJECT_PRODUCTION_URL` (fallback), `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (client), `BETA_DRY_RUN` (tests only, must never be set in production), `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` (Playwright only, never committed). `.env.local` exists locally with the two Supabase values, is gitignored and vercelignored, and has never been committed (verified over `git log --all`). Vercel's production env-var list could not be read (403).

### 1.5 Where user data is collected or stored

| Data | Where collected | Where stored | Notes |
|---|---|---|---|
| Beta application: name, email, organisation, role, boat types, location, free-text message | `/beta` form | `public.beta_signups` (anon column-level INSERT only, RLS on, unique on `lower(email)`) | 3 rows at audit time |
| Marketing attribution: `from_cta`, `utm_*`, referrer host | captured into `sessionStorage` on first page view, injected at submit | same table | not disclosed to the applicant |
| Auth accounts: email (any address typed into the login form), Google profile | `/app/login` | Supabase `auth.users` | accounts are created for anyone, allowed or not |
| Allow-list | manual SQL | `public.allowed_users` | 1 row |
| Team, boat, seat metadata; per-stroke force data; raw session files (`meta.json`, `strokes.csv`, `curves.bin`, `events.csv`); device ids and firmware hash | dashboard upload | `teams`, `team_members`, `boats`, `seats`, `sessions` (incl. whole `meta.json` as jsonb), `strokes`, `session_files`, Storage bucket `sessions/<team>/<session>/` | all tables currently empty |
| GPS track of an outing (lat/lon/speed/heading at 10 Hz) | future Vieve upload | `gps_points` | schema exists, no writer yet |
| Page views, web vitals, click and section events | every page | Vercel Analytics / Speed Insights; PostHog only if a key is set | no consent mechanism |
| Server logs (IP, user agent, `console.error` payloads) | every request | Vercel function logs | retention per Vercel plan |

---

## 2. Executive summary: the ten issues that matter most

Ranked by real-world risk to RowTech today, not by category severity alone.

1. **Any beta user can join any team as "owner" (SEC-001, High, CONFIRMED).** The `team_members` insert policy checks only `is_beta_user()` and `user_id = auth.uid()`; it never checks `team_id`. Every other policy delegates to team membership, so one PostgREST call with a known team uuid (leaked in signed Storage URLs and `session_stats.team_id`) grants read, update and delete over another crew's sessions, strokes, GPS points and files. Only one user is on the allow-list today, so exposure is latent, but it is a one-line policy fix that must land before a second crew is onboarded.
2. **Session uploads very likely fail against the live schema (CODE-001, High, CONFIRMED at schema level).** The upload does `upsert(..., { onConflict: "team_id,device_id,session_uuid" })`, but the only unique index on those columns is partial (`WHERE device_id IS NOT NULL AND session_uuid IS NOT NULL`, verified in `pg_indexes`). Postgres cannot use a partial index as an ON CONFLICT arbiter without a matching predicate, which PostgREST never sends, so every seat-session insert should fail with error 42P10. The dashboard tables are all empty and the only upload test is skipped, which is consistent with the path never having run end to end. Verify with one upload on a branch database.
3. **No privacy policy or terms, and the one privacy sentence on the site is inaccurate (LEG-001, LEG-002, High, CONFIRMED).** The site collects PII on `/beta`, creates Supabase accounts for any email on `/app/login`, and is built to hold per-athlete force and GPS data uploaded by school coaches, with no notice, no terms, no deletion path and no contact address. "We'll only use this to talk to you about the RowTech beta" is contradicted by the UTM/referrer attribution stored with every application and by Vercel Analytics on every page. This also blocks Google OAuth verification.
4. **The name "RowTech" is already used by a direct competitor in the same category (BIZ-023, Critical for the business, CONFIRMED).** rowtechsolutions.com sells a glue-on oarlock force-and-angle sensor, a GPS unit that syncs eight seats and an app, with pricing, testimonials and named founders. A search for "RowTech rowing" does not return rowtech.app. Decide on the name before units and beta crews carry it.
5. **Next.js 16.2.3 carries a critical advisory set; several entries are reachable here (SEC-002, High, CONFIRMED).** Server-action and RSC denial-of-service advisories apply directly (two server actions are unauthenticated and accept 25 MB bodies), the image optimizer is enabled, and internal server-function endpoints can be enumerated. Fix is `next@16.3.6`, same major.
6. **The upload pipeline is not safe to run with real data (CODE-002, CODE-003, CODE-004, CODE-006, High, CONFIRMED).** Times typed into the upload form are stored in UTC as if they were local; ten sequential writes with no transaction leave orphan rows and files on any failure; re-uploading a multi-seat outing creates a second empty crew parent every time; and the port/starboard buttons silently do nothing for any outing uploaded without a boat name, while the UI shows them as saved.
7. **Anyone can create accounts and trigger sign-in emails without limit (SEC-007, Medium, CONFIRMED).** `shouldCreateUser: true` plus no app-side rate limit or CAPTCHA turns the login form into an email-spam and quota-exhaustion vector; if the built-in Supabase SMTP is still in use, real beta users cannot receive magic links at all.
8. **Primary navigation lands in the wrong place and dead ends are unbranded (UX-001, UX-003, A11Y-001, High, CONFIRMED).** `content-visibility: auto` with a fixed 900 px placeholder makes `/#faq` and the mobile-menu FAQ link scroll hundreds of pixels past or short of the target. The 404 page is Next's white default with no header, footer or link home, and there is no skip link on any page.
9. **The conversion page tells search engines it is a duplicate of the home page (SEO-001, High, CONFIRMED).** `/beta` inherits `alternates.canonical: "/"` from the root layout, so its canonical is `https://www.rowtech.app`. Open Graph tags on every subpage are also the home page's, and there is no robots.txt or sitemap.
10. **The product pages ship a 249 kB gzipped three.js chunk on every visit, and the first ten seconds of the home page give a sceptical coach nothing to trust (PERF-001, BIZ-001, High).** The "lazy" 3D diagram loads within a second of navigation on every screen size (mobile TBT 2.7 to 3.0 s), and the hero offers a concept render captioned "concept design", a headline that reads as a malapropism ("imperative data"), no photo, no price for Force, no people and no email.

### Counts

| Category | Critical | High | Medium | Low | Info | Total |
|---|---|---|---|---|---|---|
| Security (SEC) | 0 | 2 | 5 | 18 | 11 | 36 |
| Legal and compliance (LEG) | 0 | 4 | 7 | 4 | 3 | 18 |
| Content and copy (CNT) | 0 | 0 | 3 | 11 | 8 | 22 |
| User experience (UX) | 0 | 3 | 5 | 5 | 3 | 16 |
| Layout and formatting (FMT) | 0 | 0 | 2 | 3 | 2 | 7 |
| Accessibility (A11Y) | 0 | 2 | 4 | 5 | 1 | 12 |
| Performance (PERF) | 0 | 3 | 5 | 5 | 4 | 17 |
| SEO | 0 | 1 | 3 | 4 | 6 | 14 |
| Code quality and reliability (CODE) | 0 | 6 | 10 | 16 | 11 | 43 |
| Business and positioning (BIZ) | 2 | 12 | 11 | 3 | 2 | 30 |
| Lead findings from live checks and the final pass (LEAD) | 0 | 0 | 0 | 4 | 6 | 10 |
| **Total** | **2** | **33** | **55** | **78** | **57** | **225** |

Counts are computed from the finding headers below (SEC-003 is counted as Info because it was closed by a live check).

---

## 3. Findings by category

Each finding has an ID, severity, status, location, explanation, evidence, a suggested fix (description only, nothing was implemented) and an effort estimate (S = under a day, M = a few days, L = a week or more). Lead corrections made after the specialist passes are marked **[Lead note]**.



## 3.1 Security (SEC)

### SEC-001 Any beta user can join ANY team (as "owner") — `team_members` insert policy does not constrain `team_id` or `role`
- Severity: High
- Status: CONFIRMED (policy defect); exploitation requires knowing a target team's uuid, which the app leaks (see SEC-009)
- Location: supabase/migrations/20260922180943_session_model.sql:136
- What's wrong and why it matters: The only INSERT policy on `public.team_members` checks `is_beta_user()` and `user_id = auth.uid()`. It never checks that the caller is allowed into `team_id`, and never restricts `role`. Every other policy (teams, boats, seats, sessions, session_files, strokes, gps_points, storage.objects) delegates to `is_team_member(team_id)`, so membership is the entire authorisation model. A signed-in user on `allowed_users` can therefore call PostgREST directly with the publishable key and their own JWT (`POST /rest/v1/team_members {"team_id":"<victim>","user_id":"<self>","role":"owner"}`) and instantly gain read/update/delete over the victim team's sessions, strokes, GPS tracks, boats and every object under `sessions/<team_id>/` in Storage (`deleteSession` in the app would then also work against them). The app UI never exposes this, but server actions and PostgREST are reachable without the UI. Team uuids are not secret-grade: they appear in the storage path of every signed curves.bin URL rendered into the session page (SEC-009) and in `session_stats.team_id`, which any member sees.
- Evidence:
  - `create policy "join own team"  on public.team_members for insert to authenticated with check (public.is_beta_user() and user_id = (select auth.uid()));` (session_model.sql:136) — no `team_id` predicate, no `role` predicate.
  - `create policy "members delete" on public.sessions for delete to authenticated using (public.is_team_member(team_id));` (session_model.sql:151) — membership is sufficient for delete.
  - Team id in a browser-visible URL: ``const path = `${team}/${row.id}/${name}`;`` (app/app/(dash)/force/actions.ts:196) and `sb.storage.from("sessions").createSignedUrl(file.path, 3600)` (app/app/(dash)/force/[id]/page.tsx:55) → rendered as `curvesUrl` and fetched client-side (components/dash/session-viewer.tsx:42).
- Suggested fix: Replace the policy with one that only allows self-insert into a team the caller created (`exists (select 1 from public.teams t where t.id = team_id and t.created_by = auth.uid())`) and forces `role = 'owner'` on that path; add an explicit invite mechanism (security-definer RPC) for adding other members. Also consider a per-user "at most one owned team" constraint.
- Effort: S

### SEC-002 `next` 16.2.3 carries a Critical advisory set; several entries are reachable in this app's configuration
- Severity: High
- Status: CONFIRMED (versions); reachability assessed per advisory below
- Location: package.json:26 (`"next": "16.2.3"`), node_modules/next/package.json (`16.2.3`); fix available: 16.3.6 (`npm audit` → `fixAvailable: {"name":"next","version":"16.3.6","isSemVerMajor":false}`)
- What's wrong and why it matters: `npm audit --json` lists 24 advisories against the installed `next` (2 critical, 12 high, 8 moderate, 2 low). Reachability in RowTech's configuration (App Router, Node runtime, Vercel/Linux, server actions, `proxy.ts` used only for session refresh, image optimizer enabled for same-origin images, no CSP nonces, no custom server, no rewrites, no WebSocket upgrades, no Cache Components, no i18n):
  - REACHABLE: GHSA-m99w-x7hq-7vfj "Denial of Service in App Router using Server Actions" (high) — five server actions are live, two of them unauthenticated (beta form, magic link). GHSA-8h8q-6873-q5fj "Denial of Service with Server Components" (high). GHSA-955p-x3mx-jcvp "Unauthenticated disclosure of internal Server Function endpoints" (moderate) — would expose the action IDs for `uploadSession`/`deleteSession`/`setSeatSide` without needing a dashboard session (they are otherwise only in chunks served to signed-in users). GHSA-h64f-5h5j-jqjh "DoS in the Image Optimization API" (moderate) — `/_next/image?url=%2Fog.png&w=64&q=75` returns 200 live. GHSA-68g3-v927-f742 / GHSA-4633-3j49-mh5q cache confusion for requests with bodies (moderate). GHSA-wfc6-r584-vfw7 / GHSA-vfv6-92ff-j949 RSC cache poisoning (moderate/low) — `/` is prerendered and CDN-cached (`X-Vercel-Cache: HIT`).
  - LOW / NOT REACHABLE: GHSA-267c-6grr-h53f, GHSA-26hh-7cqf-hhc6, GHSA-492v-c6pp-mqqv, GHSA-6gpp-xcg3-4w24, GHSA-36qx-fr4f-26g5, GHSA-3g8h-86w9-wvmq (middleware/proxy bypass & redirect poisoning) — `proxy.ts` only refreshes the Supabase cookie; authorisation is in `app/app/(dash)/layout.tsx:10-12` and RLS, so bypassing the proxy gains nothing (proxy.ts:4-6 says so explicitly). GHSA-p293-qw3h-jr36 (critical, Windows RCE) — Vercel runs Linux; only relevant to a Windows dev box running `next start` exposed to a network. GHSA-2xp9-vwfh-vxw4 (critical, AVIF RCE in image optimizer) — optimizer accepts only same-origin `url=` (remote URL returns 400 live) and no user-uploaded image is ever served from the site origin (uploads go to Supabase Storage), so an attacker cannot feed it an AVIF; still, the vulnerable code is deployed. GHSA-q8wf-6r8g-63ch (SVG DoS) — `dangerouslyAllowSVG` is off (`/_next/image?url=%2Ficon.svg` → 400). GHSA-c4j6-fc7j-m34r (WebSocket SSRF), GHSA-89xv-2m56-2m9x (SSRF on custom servers), GHSA-p9j2-gv94-2wf4 (rewrites SSRF), GHSA-4c39-4ccg-62r3 (Edge runtime action payload), GHSA-ffhc-5mcf-pf4q (CSP nonce XSS), GHSA-gx5p-jg67-6x7h (beforeInteractive XSS — no `next/script` usage, grep confirms), GHSA-mg66-mrh9-m8jx (Cache Components) — not used.
- Evidence: scratchpad/npm-audit.json; `npm audit` summary `{"info":0,"low":3,"moderate":5,"high":9,"critical":1,"total":18}`; advisory URLs all of the form https://github.com/advisories/<id> as listed above. Live: `curl -sI "https://www.rowtech.app/_next/image?url=%2Fog.png&w=64&q=75"` → `HTTP/1.1 200 OK`.
- Suggested fix: `npm install next@16.3.6 eslint-config-next@16.3.6` (same major, no code change expected per the audit), redeploy, re-run `npm audit`. Add a Dependabot/Renovate rule for `next`.
- Effort: S

### SEC-003 `beta_signups` RLS state and grants cannot be verified from the repo — if RLS is off or the default `authenticated` grants survive, every self-registered account can read all applicant PII
- Severity: Info (closed)
- Status: CLOSED. **[Lead note]** Verified live after this pass: RLS is enabled on `beta_signups`, the only policy is `anyone can sign up` (INSERT to `anon`), `anon` holds column-level INSERT only, `authenticated` holds nothing, and an anonymous `GET /rest/v1/beta_signups` returns 401. See LEAD-005. The missing migration should still be committed so this stays reviewable.
- Location: supabase/migrations/20260922174849_extend_beta_signups.sql:1-3, :30-32; lib/supabase/anon.ts:3-4; .env.example:1-2
- What's wrong and why it matters: The table was created by migration `20260913224311_create_beta_signups`, which is not in `supabase/migrations/` (the extend migration references it by name). The repo therefore contains no `enable row level security`, no policy, and no `revoke` for `beta_signups`; the only grant visible is a column-level INSERT to `anon` for the new columns (line 31-32). Supabase's default privileges grant ALL on new `public` tables to `anon`, `authenticated` and `service_role`. Two dangerous states are consistent with what the repo shows: (a) RLS never enabled → `anon` (the publishable key with no JWT) can `GET /rest/v1/beta_signups` and read every name/email/org/message; (b) RLS enabled but the default `authenticated` grant not revoked and a permissive policy exists → any account (anyone can self-register via magic link, SEC-007) can read the table. The comment in .env.example ("can only INSERT ... cannot read anything back") is a claim, not evidence.
- Evidence: `-- public.beta_signups (created 20260913224311_create_beta_signups)` (extend_beta_signups.sql:2) — file absent: `ls supabase/migrations` shows only the five 20260922* files. `grant insert (boat_types, from_cta, ...) on public.beta_signups to anon;` (extend_beta_signups.sql:31-32) is the only grant statement in the repo.
- Suggested fix: Run, as the project owner (SQL editor, read-only):
  ```sql
  select relname, relrowsecurity, relforcerowsecurity from pg_class where oid = 'public.beta_signups'::regclass;
  select policyname, roles, cmd, qual, with_check from pg_policies where schemaname='public' and tablename='beta_signups';
  select grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='beta_signups' order by 1,2;
  select grantee, column_name, privilege_type from information_schema.column_privileges where table_schema='public' and table_name='beta_signups' and grantee in ('anon','authenticated') order by 1,2;
  ```
  Expected safe state: `relrowsecurity = true`; exactly one policy, `for insert to anon with check (true)` (or similar); `role_table_grants` shows NO `SELECT/UPDATE/DELETE` for `anon` or `authenticated`; column privileges for `anon` are INSERT only. If not, run `alter table public.beta_signups enable row level security; revoke all on public.beta_signups from anon, authenticated;` then re-grant column INSERT to anon. Also commit the missing `20260913224311` migration to the repo so the table's security is reviewable. Run Supabase's Security Advisor (Dashboard → Database → Security Advisor) which flags RLS-disabled tables.
- Effort: S

### SEC-004 Removing a user from `allowed_users` does not revoke data access — team membership persists and two server actions never check the viewer
- Severity: Medium
- Status: CONFIRMED
- Location: app/app/(dash)/force/actions.ts:210-219 (`deleteSession`), app/app/(dash)/cox/actions.ts:7-15 (`setSeatSide`), supabase/migrations/20260922180943_session_model.sql:131-171 (no policy references `is_beta_user()` except the two INSERTs on teams/team_members)
- What's wrong and why it matters: `is_beta_user()` is only consulted at (1) the dashboard layout (UI gate), (2) `uploadSession`/`teamId()`, and (3) the INSERT policies for `teams` and `team_members`. All SELECT/UPDATE/DELETE policies use `is_team_member()` alone. So the documented off-boarding step ("delete the row from allowed_users") removes the UI but not the data: the user still holds `team_members` rows and can (a) read/modify/delete everything in their team via PostgREST with the publishable key + their still-valid session, and (b) call the `deleteSession` and `setSeatSide` server actions directly — those two have no `getViewer()` check at all and rely entirely on RLS. For a currently-allowed but non-member user the RLS design is sufficient (all queries return zero rows → no-op), so the missing check is not an IDOR today; it becomes one the moment the beta list is used to revoke access. There is also no DELETE policy on `team_members` or `teams` (SEC-020), so revocation requires SQL.
- Evidence: `export async function deleteSession(id: string)` (force/actions.ts:210) → `const sb = await supabaseServer();` (:211) with no `getViewer()`; `export async function setSeatSide(sessionId, side)` (cox/actions.ts:7) same; `create policy "members read" on public.sessions for select to authenticated using (public.is_team_member(team_id));` (session_model.sql:148). README.md:45-52 documents `allowed_users` as the access mechanism.
- Suggested fix: Either fold `is_beta_user()` into `is_team_member()` (`select exists(...) and public.is_beta_user()`) so revocation is instant at the RLS layer, or document that off-boarding must also delete `team_members` rows. Add `const v = await getViewer(); if (v.state !== "allowed") return;` to `deleteSession` and `setSeatSide` for defence in depth.
- Effort: S

### SEC-005 Unbounded zip decompression in the upload path (zip bomb / memory exhaustion on the serverless function)
- Severity: Medium
- Status: CONFIRMED (code); exploitable only by signed-in users on `allowed_users`
- Location: lib/session/collect.ts:41-45; app/app/(dash)/force/actions.ts:31-41, 43-53; next.config.ts:6
- What's wrong and why it matters: `unzipSync(bytes)` (fflate 0.8.3) inflates every entry of the archive into memory with no entry-count, per-entry-size or total-size cap, and no `filter` option. fflate's `unzipSync` allocates `new u8(su)` for each entry where `su` is the *declared* uncompressed size from the central directory (node_modules/fflate/esm/index.mjs:2704), so a 25 MB request (the `bodySizeLimit`) can declare ~25 GB of output (DEFLATE ratio ≈ 1032:1) and the function dies with OOM. Entries are only kept if the basename is one of four names (collect.ts:15-20), but the allocation and inflation happen before that filter. Only outer `.zip` files are expanded (a `.zip` inside a zip is ignored by `place()`), so there is no recursive bomb. Every allowed user can trigger it; impact is availability/cost of the Vercel function, not data.
- Evidence: `const entries = unzipSync(bytes);` (collect.ts:41) — no options; `serverActions: { bodySizeLimit: "25mb" }` (next.config.ts:6); fflate: `files[fn] = inflateSync(data.subarray(b, b + sc), { out: new u8(su) });` (esm/index.mjs:2704).
- Suggested fix: Pass `{ filter: (f) => WANTED[basename(f.name)] && f.originalSize <= 8 * 1024 * 1024 }` to `unzipSync`, cap entry count (e.g. 64) and total declared size (e.g. 64 MB), and lower `bodySizeLimit` toward what an eight really needs (README says ~30 kB per file, 4 files per seat → ~1 MB).
- Effort: S

### SEC-006 No Content-Security-Policy, no X-Frame-Options / frame-ancestors, no X-Content-Type-Options, no Referrer-Policy, no Permissions-Policy on any response
- Severity: Medium
- Status: CONFIRMED (live)
- Location: next.config.ts:1-14 (no `headers()`), live https://www.rowtech.app/ and https://www.rowtech.app/app/login
- What's wrong and why it matters: The dashboard and the login page can be framed by any origin (clickjacking of the "Sign out", "Upload", "P/S" buttons, or UI-redress on the magic-link form to have a victim request a link). No CSP means any future XSS (there is none today — SEC-030) runs unconstrained and there is no `frame-ancestors`. No `X-Content-Type-Options: nosniff` on HTML/JS. `Referrer-Policy` is unset so browsers use `strict-origin-when-cross-origin`: acceptable, but the signed Storage URLs (SEC-009) and `/app/cox/compare?a=<uuid>&b=<uuid>` carry identifiers in the URL and an explicit policy would be better. No `Permissions-Policy`.
- Evidence: `curl -sI https://www.rowtech.app/app/login` → headers present: `Cache-Control, Content-Type, Date, Link, Server, Strict-Transport-Security, Vary, X-Matched-Path, X-Powered-By, X-Vercel-Cache, X-Vercel-Id` — no CSP/XFO/XCTO/Referrer-Policy/Permissions-Policy. Same for `/`.
- Suggested fix: Add `headers()` in next.config.ts (or `vercel.json`) with at least `Content-Security-Policy: frame-ancestors 'none'` (or `X-Frame-Options: DENY`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`; then iterate toward a full CSP (Next 16 supports nonces; note GHSA-ffhc-5mcf-pf4q is fixed in 16.2.5+, so upgrade first per SEC-002).
- Effort: S

### SEC-007 Open self-registration into Supabase Auth (`shouldCreateUser: true`) with no app-side rate limit or CAPTCHA — account and email spam vector
- Severity: Medium
- Status: CONFIRMED (code); effective limits NEEDS MANUAL CHECK (Supabase dashboard)
- Location: app/app/login/actions.ts:19-33; app/app/login/login-form.tsx:51-79
- What's wrong and why it matters: `sendMagicLink` validates only the regex `EMAIL` and calls `signInWithOtp({ email, options: { shouldCreateUser: true } })`. Anyone can therefore (a) create unlimited `auth.users` rows for arbitrary addresses, (b) make RowTech send unsolicited sign-in emails to third parties (reputation/abuse), and (c) burn the project's email quota so real beta users cannot log in. The action returns the same message regardless (good for enumeration), but nothing in the app throttles by IP or address. The only limits are Supabase's: per its docs, `/auth/v1/otp` defaults to 360 OTPs/hour project-wide and a 60 s per-address window; email sends via custom SMTP default to 30/hour; the built-in SMTP is far lower and **only delivers to the organisation's own team members** — which would also mean production login is broken for real beta crews unless custom SMTP is configured. Since access is gated by `allowed_users` anyway, creating accounts for unknown emails has no benefit to the product.
- Evidence: `options: { emailRedirectTo: await callbackUrl("/app"), shouldCreateUser: true }` (login/actions.ts:26). Supabase docs (search_docs, "Rate limits"): "Send One-Time-Passwords (OTP) `/auth/v1/otp` ... Defaults to 360 OTPs per hour"; "Send OTPs or magic links ... 60 seconds window"; Custom SMTP guide: "Supabase Auth will refuse to deliver messages to addresses that are not part of the project's team" (built-in SMTP) and "a low rate-limit of 30 messages per hour is imposed" (custom SMTP default).
- Suggested fix: Set `shouldCreateUser: false` and pre-create users when adding them to `allowed_users` (or check `allowed_users` first via a security-definer RPC that takes an email, keeping the response constant-shape). Enable Supabase Auth CAPTCHA (hCaptcha/Turnstile) and lower `rate_limit_otp`. Verify in Dashboard → Authentication → Rate Limits and → Emails → SMTP that custom SMTP is configured and limits are sane. The Google OAuth path also auto-creates accounts; same mitigation applies via the RPC check in the callback.
- Effort: M

### SEC-008 No per-user quota on uploads: unbounded sessions, rows, and Storage objects per allowed user
- Severity: Medium
- Status: CONFIRMED
- Location: app/app/(dash)/force/actions.ts:43-207; supabase/migrations/20260922180943_session_model.sql:162-164
- What's wrong and why it matters: Each `uploadSession` call may carry 25 MB, creates up to N sessions, inserts strokes in batches of 500 with no upper bound on rows (a 25 MB strokes.csv is ~400k rows → 800 inserts, long function execution), stores up to four objects per session (bucket cap is 50 MB per object, none per user or per team), and writes the entire meta.json into `sessions.meta` jsonb (SEC-015). There is no count limit on `files` in the FormData either. `recorded_at`, `title`, `boat` are user-controlled but harmless. A single hostile or careless beta user can run the Supabase free/pro tier out of storage and DB space and inflate the Vercel function bill. `strokes.delete()` before re-insert (line 165) also lets a re-upload of the same `session_uuid` churn rows indefinitely.
- Evidence: `for (let i = 0; i < rows.length; i += 500) { ... insert(rows.slice(i, i + 500)) }` (force/actions.ts:182-185) with `rows` from `strokes.length` (unbounded); `insert into storage.buckets ... file_size_limit 52428800` (session_model.sql:162-164) — per object only.
- Suggested fix: Cap strokes per session (e.g. 20 000), files per request (e.g. 36), sessions per team/day, and total bytes per team (a `team_quota` table or a count check in `teamId()`); reduce `bodySizeLimit`; add `allowed_mime_types` on the bucket.
- Effort: M

### SEC-009 Signed Storage URLs (1 h) embedded in the session page leak the team uuid and are shareable with anyone
- Severity: Low (Medium when chained with SEC-001)
- Status: CONFIRMED (code); live NEEDS MANUAL CHECK (requires an allowed account)
- Location: app/app/(dash)/force/[id]/page.tsx:54-62; components/dash/session-viewer.tsx:42
- What's wrong and why it matters: `createSignedUrl(file.path, 3600)` produces `https://<ref>.supabase.co/storage/v1/object/sign/sessions/<team_uuid>/<session_uuid>/curves.bin?token=...`, which is rendered into the RSC payload/HTML and fetched by the browser. Anyone who obtains the URL (browser history, proxy logs, a screenshot of DevTools, a shared HAR) can download the file for an hour without a session, and learns the `team_uuid` needed for SEC-001. curves.bin is not sensitive on its own (force curves), so the standalone impact is low.
- Evidence: `const signed = file?.path ? await sb.storage.from("sessions").createSignedUrl(file.path, 3600) : null;` (force/[id]/page.tsx:55); `fetch(s.curvesUrl)` (session-viewer.tsx:42).
- Suggested fix: Shorten the TTL to a few minutes, or proxy the file through a route handler that checks the session (`sb.storage.from("sessions").download(path)` server-side) so no team uuid or bearer token reaches the client; fix SEC-001 regardless.
- Effort: S

### SEC-010 Supabase auth cookies are set without the `Secure` attribute and without a `__Host-` prefix
- Severity: Low
- Status: CONFIRMED (library defaults + code passes them through); live NEEDS MANUAL CHECK
- Location: proxy.ts:16-20; lib/supabase/server.ts:24-26; node_modules/@supabase/ssr/dist/main/utils/constants.js:4-11
- What's wrong and why it matters: `@supabase/ssr` 0.12.7 `DEFAULT_COOKIE_OPTIONS = { path: "/", sameSite: "lax", httpOnly: false, maxAge: 400 days }` — no `secure`. The app forwards `options` unchanged to `response.cookies.set(...)`/`jar.set(...)`, and Next's cookie serializer only emits `Secure` when asked (`...secure && { secure: true }`, next/dist/compiled/@edge-runtime/cookies/index.js:96). So `sb-<ref>-auth-token(.N)` cookies (access + refresh token, base64) can be sent over plain HTTP if a request ever goes to `http://www.rowtech.app` before HSTS is cached, and cannot use `__Host-` isolation. `httpOnly:false` is a deliberate Supabase design (the browser client reads the cookie) but this app has no browser client, so `httpOnly: true` would work here. `sameSite=lax` is fine for the magic-link GET callback. 400-day cookie lifetime means the refresh token lives on the device essentially forever (SEC-024).
- Evidence: constants.js:4-11 (quoted above); `for (const { name, value, options } of list) response.cookies.set(name, value, options);` (proxy.ts:19); no `cookieOptions` passed to `createServerClient` anywhere (grep). Live: `curl -sI https://www.rowtech.app/app/login` sets no cookie on GET, so flags can only be observed after a real login.
- Suggested fix: Pass `cookieOptions: { secure: true, httpOnly: true, sameSite: "lax", path: "/" }` to both `createServerClient` calls (verify the OAuth PKCE code-verifier cookie still round-trips). Manual check after login: DevTools → Application → Cookies → confirm `Secure` and `HttpOnly` on `sb-*-auth-token*`.
- Effort: S

### SEC-011 HSTS without `includeSubDomains` or `preload`
- Severity: Low
- Status: CONFIRMED (live)
- Location: live https://www.rowtech.app/ and https://rowtech.app/
- What's wrong and why it matters: Vercel emits `Strict-Transport-Security: max-age=63072000` on both apex and www, but not `includeSubDomains; preload`. First visits and any subdomain (e.g. a future `app.rowtech.app`) are still exposed to SSL-strip until the header is cached; the domain is not on the browser preload list.
- Evidence: `curl -sI https://rowtech.app/` → `Strict-Transport-Security: max-age=63072000`; same on www.
- Suggested fix: Add `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` via `headers()` (Vercel lets the app override), then submit to hstspreload.org once all subdomains are HTTPS.
- Effort: S

### SEC-012 `X-Powered-By: Next.js` disclosed on dynamic responses
- Severity: Low
- Status: CONFIRMED (live)
- Location: next.config.ts (no `poweredByHeader: false`); live /app/login, /app, /app/force
- What's wrong and why it matters: Framework fingerprinting makes SEC-002 trivially targetable.
- Evidence: `curl -sI https://www.rowtech.app/app/login` → `X-Powered-By: Next.js`.
- Suggested fix: `poweredByHeader: false` in next.config.ts.
- Effort: S

### SEC-013 Raw PostgREST/Storage error messages are returned to the user from the upload action
- Severity: Low
- Status: CONFIRMED
- Location: app/app/(dash)/force/actions.ts:107, 127, 161, 184, 200
- What's wrong and why it matters: Five branches format `${error.message}` straight into the UI (`The boat couldn't be saved: ...`, `The strokes couldn't be saved: ...`, `${name} couldn't be stored: ...`). Postgres messages disclose constraint names, column names, enum labels and the schema (`new row for relation "sessions" violates check constraint "sessions_title_check"`, `invalid input syntax for type smallint`, RLS `new row violates row-level security policy for table "sessions"`). Low impact, but it is a reconnaissance aid for SEC-001-style API probing and the messages are shown via `whitespace-pre-line` (upload-form.tsx:50).
- Evidence: ``if (error) return { status: "error", message: `The boat couldn't be saved: ${error.message}` };`` (force/actions.ts:107).
- Suggested fix: Log `error` server-side and return a fixed user-facing string; map the few expected cases (duplicate boat name, too long) to friendly text.
- Effort: S

### SEC-014 `title` and `boat` lengths (and stroke numeric ranges) are enforced only client-side / by DB CHECKs
- Severity: Low
- Status: CONFIRMED
- Location: app/app/(dash)/force/actions.ts:88-89; app/app/(dash)/force/upload-form.tsx:79, 85; supabase/migrations/20260922180943_session_model.sql:45, 69
- What's wrong and why it matters: `maxLength={120}` lives in the browser only; the server trims and forwards. The DB CHECKs (`char_length(name) between 1 and 120`, `char_length(title) <= 120`) catch it, but the failure path is SEC-013's message leak and, for `title`, the failure happens after the parent crew session insert (line 115-128) has already succeeded → a half-written crew session. Likewise `strokes.csv` values are `Number()`-coerced with no range check; `peak_pos_pct smallint` or `drive_ms integer` overflow → DB error mid-loop after earlier batches committed (no transaction).
- Evidence: `const title = (fd.get("title") as string | null)?.trim() ?? "";` (force/actions.ts:89) — no length check; ``title: title || `${parsed.length} seats` `` inserted at :121 before any stroke validation.
- Suggested fix: Validate `title`/`boat` (≤120 chars) and stroke numeric ranges in `parseStrokes`/the action before any write; wrap the multi-row write in an RPC/transaction or write children before the parent.
- Effort: S

### SEC-015 Whole `meta.json` is stored verbatim into `sessions.meta` jsonb with no size or shape limit
- Severity: Low
- Status: CONFIRMED
- Location: app/app/(dash)/force/actions.ts:154; supabase/migrations/20260922180943_session_model.sql:82
- What's wrong and why it matters: `JSON.parse(decode(raw.meta!))` stores whatever the user uploaded (up to the 25 MB body) as jsonb, after `parseMeta` has only validated the fields it needs. Any extra keys (arbitrary user content, tens of MB) land in the row and would be selected by any future `select *` on `sessions` (today's list queries name their columns). Contains device ids and firmware git hash, which is fine for team members.
- Evidence: `meta: JSON.parse(decode(raw.meta!)) as Record<string, unknown>,` (force/actions.ts:154).
- Suggested fix: Store only the parsed `SessionMeta` (or cap `raw.meta.byteLength` at e.g. 64 kB) and add `check (pg_column_size(meta) < 65536)`.
- Effort: S

### SEC-016 `deleteSession`: Storage objects are removed before the DB delete, it is dead code (no UI caller), and `id` is not validated
- Severity: Low
- Status: CONFIRMED
- Location: app/app/(dash)/force/actions.ts:210-219
- What's wrong and why it matters: (1) Ordering: `storage.remove(paths)` runs first; if the subsequent `sessions.delete()` fails (RLS, network) the rows remain pointing at deleted objects, and results of all four calls are ignored (no error handling). (2) `grep` finds no caller of `deleteSession` in any component — it is an exported `"use server"` function in a module imported by a client component (`upload-form.tsx:8` imports `uploadSession` from the same file), so it is compiled into the action manifest and reachable by POST, purely as extra attack surface. (3) `id` is used unvalidated in `.eq("parent_id", id)`; a non-uuid just yields a Postgres cast error that is swallowed.
- Evidence: `if (files?.length) await sb.storage.from("sessions").remove(files.map((f) => f.path));` (:215) precedes `await sb.from("sessions").delete().eq("id", id);` (:217); `grep -rn "deleteSession" app components` → only the definition.
- Suggested fix: Delete the DB rows first (cascade), then remove objects, and log failures; either wire a confirm-delete UI or remove the export until it is used; validate uuids with a regex at the top of every action.
- Effort: S

### SEC-017 Beta application form: honeypot only — no rate limit, no CAPTCHA, 25 MB request bodies accepted, duplicate submissions silently swallowed
- Severity: Low
- Status: CONFIRMED (code); live NOT TESTED (no submissions made)
- Location: app/beta/actions.ts:40-117; next.config.ts:6
- What's wrong and why it matters: Anyone can insert unlimited rows into `beta_signups` (one per distinct email; 23505 is swallowed at :98-100 so repeats are free). The `website` honeypot (:54) stops naive bots only. `bodySizeLimit: "25mb"` is global, so this unauthenticated action and `sendMagicLink` also accept 25 MB bodies that Next must parse before the action runs (amplifies GHSA-m99w-x7hq-7vfj in SEC-002). `BETA_DRY_RUN` is a plain env switch: if ever set in production the form silently stores nothing (README warns; NEEDS MANUAL CHECK that it is unset in Vercel).
- Evidence: `if (text(fd, "website")) return { status: "ok", ... }` (beta/actions.ts:54); `if (error && error.code !== "23505") throw error;` (:98).
- Suggested fix: Add Vercel WAF rate limiting (or a small Upstash/KV token bucket keyed by IP) on `/beta` POSTs, consider Turnstile, and lower the global `bodySizeLimit` to ~2 MB (chunk uploads if an eight really needs more).
- Effort: M

### SEC-018 `callbackUrl()` derives the magic-link/OAuth redirect origin from `x-forwarded-host` / `x-forwarded-proto` when `SITE_URL` is unset; `rowtech.vercel.app` is a live alias
- Severity: Low
- Status: SUSPECTED (depends on whether `SITE_URL` is set in Vercel — NEEDS MANUAL CHECK)
- Location: app/app/login/actions.ts:10-16; lib/site.ts:2-6; README.md:21 ("SITE_URL ... Optional on Vercel")
- What's wrong and why it matters: On Vercel the platform rewrites `x-forwarded-host` to the Host actually routed, and a request only reaches the function if Host is a domain of the deployment, so a client cannot inject an arbitrary host (verified: a spoofed `X-Forwarded-Host: evil.example` on `/auth/callback` still redirects to `https://www.rowtech.app/...`). But every alias of the deployment is a valid host, and `https://rowtech.vercel.app/` returns 200, so a user who signs in from the vercel.app alias (or a preview URL) gets `emailRedirectTo=https://rowtech.vercel.app/auth/callback`; Supabase only honours it if that URL is on the redirect allow-list, otherwise it falls back to the configured Site URL — then the PKCE code-verifier cookie was set on the wrong origin and the callback fails (`error=link`). Not a poisoned-link vector against a victim (the attacker cannot choose the victim's Host), but it means there are two cookie origins for the dashboard and the safety relies on the Supabase allow-list being tight. `proto` defaults to `http` if the header is missing (never on Vercel).
- Evidence: ``const host = h.get("x-forwarded-host") ?? h.get("host"); const proto = h.get("x-forwarded-proto") ?? "http"; const origin = process.env.SITE_URL || `${proto}://${host}`;`` (login/actions.ts:12-14). `curl -s -o /dev/null -w "%{http_code}" https://rowtech.vercel.app/` → 200. Spoof test: `curl -sI -H "X-Forwarded-Host: evil.example" "https://www.rowtech.app/auth/callback?next=/app"` → `Location: https://www.rowtech.app/app/login?error=link`.
- Suggested fix: Set `SITE_URL=https://www.rowtech.app` in Vercel production env (and use `siteUrl` from lib/site.ts instead of headers), redirect `*.vercel.app` → www (Vercel project → Domains, or a `redirects()` rule), and keep only `https://www.rowtech.app/auth/callback` + localhost in Supabase's redirect allow-list. Enable Vercel Deployment Protection for previews.
- Effort: S

### SEC-019 `shadcn` CLI is a production dependency, dragging `@modelcontextprotocol/sdk`, `express`, `hono`, `fast-uri`, `qs`, `js-yaml`, `nanoid`… into the prod tree (13 of the 18 audit entries)
- Severity: Low
- Status: CONFIRMED
- Location: package.json:31 (`"shadcn": "^4.2.0"` under `dependencies`); scratchpad/npm-audit.json
- What's wrong and why it matters: Real runtime exposure is low: nothing in app/, lib/ or components/ imports `shadcn` or its transitive packages, and Next's output file tracing only bundles modules actually imported, so the vulnerable `hono`/`express`/`fast-uri` code is not in the deployed serverless functions. The cost is (a) supply-chain surface on every developer/CI `npm install` (hundreds of extra packages with install-script potential), (b) a permanently red `npm audit` that hides the one advisory that matters (SEC-002), and (c) `npm ci --omit=dev` on Vercel still installs it. Advisories transitively via shadcn: `hono` (GHSA-88fw-hqm2-52qc high + 23 others), `fast-uri` (7 high), `ip-address` (GHSA-mwp4-54f8-5fhr high), `js-yaml` (3 high), `nanoid` (3 high), `brace-expansion` (high), `qs`, `body-parser`, `express-rate-limit`, `@hono/node-server`, `@humanfs/node`. `browserslist`/`baseline-browser-mapping`/`@babel/core`/`postcss`/`postcss-selector-parser`/`sharp` come via next/tailwind build tooling (build-time only; `sharp`/`postcss` fix ships with next 16.3.6).
- Evidence: `grep -rn "shadcn" app lib components` → no imports; `npm audit` shows `isDirect: false` for all of them.
- Suggested fix: `npm uninstall shadcn` and run it via `npx shadcn@latest ...` when needed (or move to devDependencies); re-run `npm audit` after SEC-002.
- Effort: S

### SEC-020 No DELETE policy on `teams` or `team_members`, no UPDATE policy on `team_members`; `role` is never enforced by any policy
- Severity: Low
- Status: CONFIRMED
- Location: supabase/migrations/20260922180943_session_model.sql:131-136, 24
- What's wrong and why it matters: Members cannot leave a team, owners cannot remove a member or delete a team, and the `role` column (`owner|coach|member`) is decorative: every policy treats all members identically (any member can rename the team via "members update", delete any session, delete Storage objects). Off-boarding (SEC-004) and any future multi-coach team therefore need dashboard SQL. Not exploitable on its own; it is the reason SEC-004 has no clean remedy.
- Evidence: policies on `teams`: select/insert/update only (:131-133); on `team_members`: select/insert only (:135-136); `role text not null default 'coach' check (role in ('owner','coach','member'))` (:24) referenced by no policy.
- Suggested fix: Add `delete` policies scoped to `role = 'owner'` (`exists (select 1 from team_members m where m.team_id = team_id and m.user_id = auth.uid() and m.role = 'owner')`) and a self-leave policy on `team_members`; restrict destructive session/boat deletes to owners/coaches.
- Effort: S

### SEC-021 Unlimited team creation via the API, and a check-then-insert race in `teamId()` that can leave a user in several teams
- Severity: Low
- Status: CONFIRMED (code)
- Location: app/app/(dash)/force/actions.ts:15-29; supabase/migrations/20260922180943_session_model.sql:132
- What's wrong and why it matters: `"beta creates"` lets any beta user insert unlimited `teams` rows directly (no per-user cap; nothing stops `insert into teams` in a loop → row bloat). In the app, `teamId()` does `select team_members ... limit(1).maybeSingle()` then `insert teams` + `insert team_members`; two concurrent first uploads (double-click, two tabs) both see no membership and each create a team, so the user is in two teams and subsequent uploads land in whichever `limit(1)` returns first. `teamId()` cannot land the user in *someone else's* team through the app path (the select is RLS-filtered to the caller's own memberships), only SEC-001 does that. The team name embeds the email local part (`${email.split("@")[0]}'s crew`, :23) — visible to team members only.
- Evidence: `const { data: mine } = await sb.from("team_members").select("team_id").limit(1).maybeSingle(); if (mine?.team_id) return mine.team_id;` (:20-21) followed by two separate inserts (:24-27) with no transaction or unique constraint.
- Suggested fix: Move team bootstrap into a security-definer RPC (`create_own_team()`) that is idempotent (`on conflict`), and add a unique partial index such as `unique (created_by) where role='owner'` or a per-user team cap.
- Effort: S

### SEC-022 `Access-Control-Allow-Origin: *` on prerendered pages and the image optimizer
- Severity: Low
- Status: CONFIRMED (live)
- Location: live https://www.rowtech.app/ , /team (404 page), /_next/image
- What's wrong and why it matters: Vercel's default for static/prerendered output. Any origin can `fetch()` the marketing HTML and images cross-origin. Dynamic pages (`/app/login`, `/app/*`) do NOT carry it (verified), so no authenticated content is readable cross-origin; impact is negligible today but would matter if a prerendered page ever included per-user data.
- Evidence: `curl -sI https://www.rowtech.app/` → `Access-Control-Allow-Origin: *`; `curl -sI https://www.rowtech.app/app/login` → header absent.
- Suggested fix: Leave as is, or set an explicit `Access-Control-Allow-Origin` in `headers()` for `/(.*)` if you want to be strict; never prerender pages with user data.
- Effort: S

### SEC-023 `rowtech.vercel.app` serves the full site including `/app` — a second origin for auth cookies and duplicate content
- Severity: Low
- Status: CONFIRMED (live)
- Location: live https://rowtech.vercel.app/
- **[Lead note]** Preview and branch deployment URLs (`rowtech-<hash>-...vercel.app`, `rowtech-git-main-...vercel.app`) return 302 to the Vercel SSO login, so previews are protected; only the `rowtech.vercel.app` production alias is public (LEAD-006).
- What's wrong and why it matters: The dashboard is reachable on two origins with independent cookie jars; a magic link requested on one origin cannot complete on the other (PKCE verifier cookie), which shows up as `error=link`. Also SEO duplicate content, and a place where SEC-018's host reflection matters. Preview deployments (if not protected) would be a third.
- Evidence: `curl -s -o /dev/null -w "%{http_code}" https://rowtech.vercel.app/` → 200.
- Suggested fix: Vercel → Project → Domains: redirect the `.vercel.app` domain to `https://www.rowtech.app`; enable Deployment Protection (Vercel Authentication) for preview deployments.
- Effort: S

### SEC-024 No absolute session lifetime: 400-day cookies and no Supabase session time-box/inactivity timeout configured from the repo
- Severity: Low
- Status: NEEDS MANUAL CHECK (Supabase Auth → Sessions settings)
- Location: node_modules/@supabase/ssr/dist/main/utils/constants.js:10 (`maxAge: 400 * 24 * 60 * 60`); proxy.ts:23-25 (refresh on every /app request)
- What's wrong and why it matters: A stolen or forgotten browser session stays valid indefinitely because the proxy refreshes the token on every visit and the cookie lives 400 days. Supabase supports "time-box user sessions" and "inactivity timeout" (Pro plan) — not verifiable from the repo.
- Evidence: constants.js:10; `await sb.auth.getUser();` (proxy.ts:24) comment "Touching the user refreshes an expiring session and writes new cookies."
- Suggested fix: Set a session time-box (e.g. 30 days) and inactivity timeout in Supabase Auth settings if the plan allows; lower the cookie `maxAge` via `cookieOptions`.
- Effort: S

### SEC-025 `session_files.path` / `strokes` / `gps_points` rows are writable by any member with arbitrary content via PostgREST (data-integrity only; no cross-team read)
- Severity: Low
- Status: CONFIRMED (policy reading)
- Location: supabase/migrations/20260922180943_session_model.sql:149-159; supabase/migrations/20260922183932_vieve_gps.sql:33-36
- What's wrong and why it matters: "members write" policies allow INSERT of `session_files` rows whose `path` points anywhere (e.g. another team's folder) and `strokes`/`gps_points` rows for any session in the caller's team. The dangerous read (`createSignedUrl` on a foreign path) is blocked by the Storage SELECT policy, and `deleteSession`'s `storage.remove` on a foreign path is blocked by the Storage DELETE policy, so this does not cross team boundaries — it only lets a member corrupt their own team's data. Recorded so the next reviewer does not re-derive it.
- Evidence: `create policy "members write" on public.session_files for insert ... with check (exists (select 1 from public.sessions s where s.id = session_id and public.is_team_member(s.team_id)))` (:154) — no check that `path` starts with `s.team_id || '/'`.
- Suggested fix: Add `and split_part(path,'/',1) = s.team_id::text` to the `session_files` write policy.
- Effort: S

### SEC-026 `console.error` on the beta path can log applicant PII: Postgres CHECK-violation `details` include the failing row
- Severity: Low
- Status: SUSPECTED (reachable only if a DB constraint rejects a row the server-side validator accepted — the base table's constraints are not in the repo)
- Location: app/beta/actions.ts:107 (`console.error("beta application failed", e)`), :95-98
- What's wrong and why it matters: PostgREST error objects carry Postgres `details`; for check violations that is `Failing row contains (name, email, ...)`. Those go to Vercel runtime logs (retention/access outside the app's control). The server validator mirrors the known limits (fields.ts:12-21) so this is unlikely, but the constraints from `20260913224311` are unknown. Other logs (`magic link failed`, login/actions.ts:29) include the Supabase AuthError (message/status only; no email).
- Evidence: `console.error("beta application failed", e);` (beta/actions.ts:107).
- Suggested fix: Log `e.code` and `e.message` only, never `details`/`hint`; commit the base migration (SEC-003).
- Effort: S

### SEC-027 `setSeatSide` trusts its `side` argument and does not validate `sessionId` at runtime
- Severity: Info
- Status: CONFIRMED
- Location: app/app/(dash)/cox/actions.ts:7-14
- What's wrong and why it matters: The TypeScript union `"port" | "starboard"` is erased; a hand-crafted POST can pass `"cox"`, `"scull"` (valid enum → accepted) or garbage (Postgres enum error → swallowed). No security impact (RLS scopes the upsert to the caller's team); listed for completeness with SEC-016.
- Evidence: `export async function setSeatSide(sessionId: string, side: "port" | "starboard")` (:7) — no runtime check on either argument.
- Suggested fix: `if (side !== "port" && side !== "starboard") return;` and a uuid regex on `sessionId`.
- Effort: S

### SEC-028 Storage policy `((storage.foldername(name))[1])::uuid` — behaviour on malformed paths is a hard error (deny), which is fine
- Severity: Info
- Status: CONFIRMED (reasoning)
- Location: supabase/migrations/20260922180943_session_model.sql:166-171
- What's wrong and why it matters: Nothing wrong. A first folder that is not a uuid makes the cast raise `invalid input syntax for type uuid`, so the request fails closed (400/403, not a silent allow). A path with no folder yields `NULL::uuid`, `is_team_member(NULL)` returns false → denied. Bucket is private (`public=false`, :163). `is_team_member`/`is_beta_user` are `security definer` with `set search_path = ''` and `revoke ... from public, anon` (:33-40, allowed_users.sql:19-32) — correct.
- Evidence: session_model.sql:166-171.
- Suggested fix: None required; optionally wrap in a helper `folder_team(name) returns uuid` that returns NULL on cast failure to avoid noisy 400s.
- Effort: S

### SEC-029 What a signed-in but NOT-allowed user can do: nothing beyond seeing their own email — verified against every policy
- Severity: Info
- Status: CONFIRMED (policy reading)
- Location: supabase/migrations/*.sql; app/app/(dash)/layout.tsx:10-12; app/app/(dash)/force/actions.ts:44-45, 16-17
- What's wrong and why it matters: For a user not on `allowed_users`: `allowed_users` SELECT returns 0 rows; `teams`/`team_members` INSERT require `is_beta_user()` → denied; every SELECT/UPDATE/DELETE requires membership they cannot obtain; `session_stats` is `security_invoker` so inherits the same; Storage policies require membership; `uploadSession` and `teamId()` refuse at `viewer.state !== "allowed"`; `deleteSession`/`setSeatSide` become no-ops (0 rows). They can only execute `is_beta_user()` (returns false) and use Supabase's own `/auth/v1/user` endpoints on their own account. The `authenticated` role also has the Supabase default table grants on all these tables, so RLS is the only barrier — and every table in the repo has RLS enabled (session_model.sql:121-127, vieve_gps.sql:29, allowed_users.sql:11); `beta_signups` is the unverifiable exception (SEC-003). `allowed_users` has no INSERT path from the app (by design; README.md:48-52 documents SQL).
- Evidence: as cited.
- Suggested fix: None; keep it this way.
- Effort: S

### SEC-030 XSS review: the only two `dangerouslySetInnerHTML` sites inject static JSON-LD; no other sinks
- Severity: Info
- Status: CONFIRMED
- Location: app/page.tsx:107-124; components/site/site-page.tsx:8; app/force/page.tsx:31-45
- What's wrong and why it matters: `JSON.stringify(jsonLd)` inside `<script type="application/ld+json">` is only unsafe if the data can contain `</script>` (or `<!--`). Both objects are compile-time constants plus `siteUrl` (env/Vercel-derived, not user input), so the sequence cannot occur. All other user-derived rendering (`viewer.email`, session `title`, boat `name`, error messages, stroke numbers) goes through React text nodes and is auto-escaped. No `innerHTML`, `eval`, `new Function`, `next/script`, or `<img src>` from user data anywhere (grep). Storage uploads are served from the Supabase origin as `application/json`/`text/csv`/`application/octet-stream` via signed URLs, never from the site origin.
- Evidence: ``const jsonLd = { "@context": "https://schema.org", "@graph": [{ "@type": "Organization", "@id": `${siteUrl}/#org`, ... }] }`` (app/page.tsx:107-119).
- Suggested fix: Optional hardening: `JSON.stringify(jsonLd).replace(/</g, "\u003c")` so the invariant survives future edits.
- Effort: S

### SEC-031 Open-redirect check in `/auth/callback` holds against the usual bypasses
- Severity: Info
- Status: CONFIRMED (tested with node against the exact code path + live GET)
- Location: app/auth/callback/route.ts:7-17
- What's wrong and why it matters: `next` must start with `/` and not `//`, and is then concatenated to `origin` and passed to `NextResponse.redirect`, which normalises through `new URL()` (next/dist/server/web/utils.js:125-127). Results: `/\evil.com` and `/%5Cevil.com` → `https://www.rowtech.app//evil.com` (same host, path `//evil.com`); `/%2F%2Fevil.com` decodes to `///evil.com` → rejected → `/app`; `https://evil.com` → `/app`; CRLF is stripped by the URL parser (no header injection). Because the value is made absolute with the request's own origin before the redirect, the backslash trick that beats relative `Location:` headers does not apply. Live: `GET /auth/callback?next=//evil.com` (no code) → `Location: https://www.rowtech.app/app/login?error=link`. `origin` itself comes from `request.url`, i.e. the routed Host — not client-controllable on Vercel (SEC-018).
- Evidence: node harness output: `"/\\evil.com" → Location: https://www.rowtech.app//evil.com`; `"/%2F%2Fevil.com" → next: "/app"`.
- Suggested fix: Optional: also reject `next` containing `\`, and prefer `new URL(next, origin).origin === origin` as the check.
- Effort: S

### SEC-032 CSRF posture of server actions (including the POST `signOut`) is Next's Origin/Host comparison — adequate
- Severity: Info
- Status: CONFIRMED (framework code)
- Location: node_modules/next/dist/server/app-render/action-handler.js:393-420; app/app/(dash)/layout.tsx:24-28; app/app/login/login-form.tsx:38
- What's wrong and why it matters: Next rejects a server-action POST whose `Origin` differs from `Host`/`x-forwarded-host` (`Invalid Server Actions request`, E80), so a cross-site form cannot invoke `signOut`, `uploadSession`, etc. A request with **no** `Origin` header is allowed through with a warning ("handcrafted requests can't contain user credentials that haven't been shared willingly") — modern browsers always send `Origin` on cross-site POST, so this is not a browser CSRF vector. `sameSite=lax` on the auth cookies adds a second layer. `serverActions.allowedOrigins` is unset (fine: single host).
- Evidence: action-handler.js:395-400 and :403-416.
- Suggested fix: None. If a `.vercel.app` alias remains (SEC-023), it is its own origin and still passes the same-origin check, which is correct.
- Effort: S

### SEC-033 Secrets review: nothing leaked — no keys in history, `.env.local` untracked and Vercel-ignored, no `NEXT_PUBLIC_` misuse, no production source maps
- Severity: Info
- Status: CONFIRMED
- Location: .gitignore:34-35 (`.env*` / `!.env.example`), .vercelignore:2-3 (same), .env.example, .env.local (untracked; contains exactly two keys `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` — values not inspected), lib/supabase/*.ts, lib/analytics.ts:10-11
- What's wrong and why it matters: `git log -p --all` grep for `sb_publishable_|sb_secret_|eyJhbGci|service_role|AKIA|sk_live|ghp_|phc_|-----BEGIN` → no hits. The only `.env*` file ever added is `.env.example` (commit d633a2c). `TEST_USER_PASSWORD`: introduced in commit 366695b (2026-09-22, "force dashboard: parse real node sessions, review them stroke by stroke") as `process.env.TEST_USER_PASSWORD` in tests/app.spec.ts:20; **no value was ever committed** (the diff adds only the env reference and a comment), and the file still exists and is tracked at HEAD (`git ls-files tests/app.spec.ts`). `.env.local` cannot ship via the Vercel CLI (`.vercelignore` excludes `.env*`) and never ships via Git deploys (untracked). Only `NEXT_PUBLIC_POSTHOG_KEY`/`_HOST` are public-prefixed, which is correct for a client analytics key; `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` are server-only and the 11 live JS chunks plus the login chunks contain no `supabase.co`, `sb_publishable_`, `phc_` or JWT strings. No `sourceMappingURL` in any served chunk; `GET /_next/static/chunks/<chunk>.js.map` → 403. `/.env`, `/.env.local`, `/.git/config` → 404. The publishable key is by design not a secret, but keeping it server-side means no browser ever talks to Supabase directly (except signed Storage URLs), which shrinks the API surface.
- Evidence: commands and outputs as described; `.vercelignore` lines 1-3.
- Suggested fix: None.
- Effort: S

### SEC-034 Playwright upload test expects a password-enabled test user on the production Supabase project, and its session hand-off does not match the app's cookie auth
- Severity: Info
- Status: CONFIRMED
- Location: tests/app.spec.ts:16-42; playwright.config.ts:21-27
- What's wrong and why it matters: The test signs in via `POST ${SUPABASE_URL}/auth/v1/token?grant_type=password` with `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` (values from env only; none committed — SEC-033) and then writes `localStorage["sb-auth"]`, which `@supabase/ssr` never reads (it uses cookies) — so the test cannot actually pass and, if someone "fixes" it by enabling password sign-in on a real allowed user, that user becomes a brute-forceable credential on the beta list. `BETA_DRY_RUN=1` is set only for the test web server (playwright.config.ts:26).
- Evidence: `await page.evaluate(([a, r]) => localStorage.setItem("sb-auth", JSON.stringify({ access_token: a, refresh_token: r })), ...)` (tests/app.spec.ts:39-42).
- Suggested fix: Use a dedicated Supabase project or local `supabase start` for tests and set the `sb-<ref>-auth-token` cookie (or use `signInWithPassword` through the app) instead of localStorage; delete any password-enabled test user from production.
- Effort: S

### SEC-035 `/team` returns 404 live now (the audit brief recorded 200); CDN cache was stale
- Severity: Info
- Status: CONFIRMED (live)
- Location: live https://www.rowtech.app/team; commit aba1b1a "site: remove the team page for now"
- What's wrong and why it matters: Resolved. **[Lead note]** The first crawl hit the previous production deployment; `aba1b1a` deployed at 14:58:51 UTC during the audit (Vercel deployment list), after which `/team` is a 404. No action.
- Evidence: `curl -sI https://www.rowtech.app/team` → `HTTP/1.1 404 Not Found`.
- Suggested fix: None.
- Effort: S

### SEC-036 Observations with no action needed (bundled Info)
- Severity: Info
- Status: CONFIRMED
- Location: various
- What's wrong and why it matters:
  - `viewer.email` is rendered in the dashboard header (layout.tsx:23) and on the request-access page (request-access.tsx:16): the user's own address, escaped by React — fine.
  - `sessions.meta` keeps device ids and the firmware git hash — visible to team members only; fine.
  - Path traversal in Storage paths: `${team}/${row.id}/${name}` — `team` and `row.id` are DB-generated uuids, `name` is one of four constants (force/actions.ts:188-196); zip entry names are only Map keys (collect.ts:22-33) — not exploitable.
  - CSV parsing: `Number()`-coerced, header checked exactly, 13-column check (parse.ts:109-142) — no injection surface; the client-side "Export CSV" (session-viewer.tsx:86-93) re-emits numbers only, so no CSV-formula injection either.
  - `is_beta_user()` compares `lower(auth.jwt()->>'email')`; both Google OAuth and magic link produce verified emails, and Supabase's secure email change (double confirmation, default on — NEEDS MANUAL CHECK it was not disabled) prevents an attacker from re-pointing an account at an allowed address.
  - `/app` and `/app/login` carry `robots: index:false` metadata (app/app/layout.tsx:5, login/page.tsx:8); no `robots.txt` exists (404) — harmless for security.
  - `OPTIONS /` → 204 (Vercel default); `TRACE` not tested.
  - `proxy.ts` returns early with no session refresh if env is missing (proxy.ts:11) — fail-open only in the sense of "no refresh"; `getViewer()` then throws → 500, not a bypass.
  - `console.error("magic link failed", error)` (login/actions.ts:29) logs the AuthError object; it carries message/status/code, not the email — acceptable.
- Evidence: as cited.
- Suggested fix: None.
- Effort: S

---

#### Unauthenticated attack surface (everything reachable without a dashboard session) and the check that protects each

| # | Endpoint | Method | Protection | Notes |
|---|---|---|---|---|
| 1 | `/`, `/beta`, `/force`, `/vieve` (pages) | GET | none (public marketing) | prerendered, `Access-Control-Allow-Origin: *` (SEC-022) |
| 2 | `/beta` → server action `submitApplication` | POST (Next-Action) | honeypot `website` field; server-side field validation; unique email (23505 swallowed) — **no rate limit/captcha** (SEC-017) | writes to `beta_signups` via publishable key; 25 MB body accepted |
| 3 | `/app/login` (page) | GET | none; redirects to `/app` if already allowed | `X-Powered-By` disclosed (SEC-012); frameable (SEC-006) |
| 4 | `/app/login` → server action `sendMagicLink` | POST (Next-Action) | email regex only; Supabase rate limits (360/h project, 60 s/address) — **creates accounts** (SEC-007) | action ids `00078c9df4c880b5…` / `60acf3a2108477b6…` are in the login chunk (public) |
| 5 | `/app/login` → server action `signInWithGoogle` | POST (Next-Action) | none (redirects to Supabase authorize URL); auto-creates accounts on return | |
| 6 | `/auth/callback?code=&next=` | GET | `code` must be a valid PKCE code paired with the verifier cookie; `next` sanitised (SEC-031) | proxy refreshes cookies; no beta check here (layout does it) |
| 7 | `/app`, `/app/force`, `/app/force/[id]`, `/app/cox`, `/app/cox/[id]`, `/app/cox/compare` | GET | `getViewer()` in `app/app/(dash)/layout.tsx:10-12` → 307 `/app/login` when signed out; `RequestAccess` when not allowed; page queries RLS-filtered | verified live: `/app/force` and `/app/force/not-a-uuid` → 307 `/app/login` |
| 8 | server action `uploadSession` (module `force/actions.ts`) | POST (Next-Action) | `getViewer().state === "allowed"` (:44-45) + RLS | zip bomb (SEC-005), no quota (SEC-008) |
| 9 | server action `deleteSession` | POST (Next-Action) | **RLS only** (SEC-004/016); unused by UI | no-op for non-members |
| 10 | server action `setSeatSide` (module `cox/actions.ts`) | POST (Next-Action) | **RLS only** (SEC-004/027) | no-op for non-members |
| 11 | server action `signOut` | POST (Next-Action) | Next Origin check (SEC-032); harmless | |
| 12 | `/_next/image?url=<same-origin path>&w=&q=` | GET | Next's same-origin allow-list (remote → 400) | DoS advisory reachable (SEC-002) |
| 13 | `/_next/static/**`, `/demo/**`, `/og.png`, `/icon.svg` | GET | none (static) | `/demo/seat-1/*` is synthetic sample data |
| 14 | Supabase PostgREST `https://<ref>.supabase.co/rest/v1/*` with the publishable key (key not in any shipped asset, but publishable by design) | any | RLS: no policies for `anon` on any repo table; `beta_signups` grants **unverified** (SEC-003) | after self-registration (SEC-007) the caller is `authenticated`: still 0 rows unless on `allowed_users` and in a team (SEC-029); allowed users can join any team (SEC-001) |
| 15 | Supabase Auth `https://<ref>.supabase.co/auth/v1/*` | any | Supabase's own limits/CAPTCHA (none configured from repo) | |
| 16 | Supabase Storage signed URLs `…/storage/v1/object/sign/sessions/<team>/<session>/curves.bin?token=` | GET | bearer token in URL, 1 h | leaks team uuid (SEC-009) |
| 17 | `https://rowtech.vercel.app/*` | GET | same app, second origin (SEC-023) | |

#### Couldn't check
- Live RLS state, policies, and grants of `public.beta_signups` (base migration `20260913224311` absent from repo). The Supabase MCP `list_projects` call was blocked by the session's permission policy, so nothing was read from the live project. Exact SQL to run is in SEC-003.
- Whether `SITE_URL`, `BETA_DRY_RUN` and `NEXT_PUBLIC_POSTHOG_KEY` are set in Vercel production env (SEC-018, SEC-017). Check Vercel → Project → Settings → Environment Variables.
- Supabase Auth settings: custom SMTP configured? rate limits (`rate_limit_otp`, `rate_limit_email_sent`), CAPTCHA, redirect allow-list contents, secure email change, session time-box/inactivity timeout (SEC-007, SEC-018, SEC-024, SEC-036). Dashboard → Authentication → Rate Limits / Emails / URL Configuration / Sessions.
- Live cookie attributes (`Secure`, `HttpOnly`, `SameSite`, `Max-Age`) on `sb-*-auth-token*` — only set after a real login, which the ground rules forbid; verify in DevTools after an owner login (SEC-010).
- Live confirmation of SEC-001 (joining a foreign team) and SEC-004 (revoked-user access) — would require writes; test on a Supabase branch or local `supabase start` with two users.
- Live confirmation of the zip-bomb OOM (SEC-005) — would require uploading; test locally with `next start` and a crafted zip.
- Whether the upload action IDs (`uploadSession`, `deleteSession`, `setSeatSide`) are exposed to unauthenticated clients through GHSA-955p-x3mx-jcvp — not attempted (would be probing a vulnerability); upgrading `next` (SEC-002) closes it regardless.
- Supabase Security Advisor output for the project (would confirm SEC-003 and flag anything else) — Dashboard → Database → Security Advisor.
- Vercel Deployment Protection status for preview deployments (SEC-023).
- `TRACE` method handling and HTTP/2-specific behaviour on Vercel — not probed.


## 3.2 Legal and compliance (LEG) and 3.3 Content and copy (CNT)

### LEG-001 No privacy policy or terms exist, but personal data is collected on two pages
- Severity: High
- Status: CONFIRMED
- Location: live `/privacy`, `/terms`, `/privacy-policy`, `/legal` all 404 (`curl -w %{http_code}`: 404 each); no route under `app/`; no link in `components/site/site-footer.tsx:14-21`, `app/beta/signup-form.tsx:239`, `app/app/login/page.tsx:24-30`, `app/app/(dash)/request-access.tsx`.
- What's wrong and why it matters: The site collects name, email, organisation, role, boat types, free-text location and a free-text message on `/beta`, creates Supabase auth accounts from any email on `/app/login` (magic link, `shouldCreateUser: true`, `app/app/login/actions.ts:26`) and via Google OAuth, and stores per-athlete performance data and GPS tracks in the dashboard. There is no privacy notice, no terms of service, no acceptable-use terms for the dashboard, and no cookie/analytics disclosure anywhere. Under CalOPPA (any commercial site collecting PII from California residents must conspicuously post a privacy policy), GDPR/UK GDPR Art. 13 (for the EU/UK visitors the form's "City, country" placeholder invites), and the FTC's unfairness/deception standards, this is the single largest gap. Google's OAuth consent-screen verification also requires a published privacy policy (see LEG-003).
- Evidence: `grep -r -i 'privacy|terms of|cookie' app components lib` returns only the PostHog `persistence: "localStorage+cookie"` line and Supabase cookie plumbing; `grep -i 'privacy|terms|cookie'` over all five fetched live pages returns nothing. Places where a link is legally or practically expected: (1) directly under the `/beta` submit button next to "We'll only use this to talk to you about the RowTech beta." (`signup-form.tsx:239`); (2) on `/app/login` under both sign-in methods (account creation); (3) in the site footer (`site-footer.tsx:14-21`) and the dashboard header (`app/app/(dash)/layout.tsx:16-31`); (4) in the Google OAuth consent screen configuration; (5) a cookie/analytics disclosure for Vercel Analytics and Speed Insights (LEG-008); (6) the `Organization` JSON-LD (`app/page.tsx:107-119`) could carry `contactPoint`.
- Suggested fix: Publish `/privacy` and `/terms` (App Router pages, linked from footer, beta form, login and the dashboard), covering what is collected on each page, the processors (Supabase, Vercel, Google), retention, rights/deletion contact, and the beta programme terms. Keep the plain-English tone the site already has.
- Effort: M

### LEG-002 The only privacy statement on the site does not match what is actually stored
- Severity: High
- Status: CONFIRMED
- Location: `app/beta/signup-form.tsx:239` ("We'll only use this to talk to you about the RowTech beta."); `app/beta/actions.ts:6-21, 74-89, 95`; `app/beta/signup-form.tsx:69-72`; `components/site/attribution.tsx:11-33`; `supabase/migrations/20260922174849_extend_beta_signups.sql:9-17, 31-32`.
- What's wrong and why it matters: The statement is a purpose limitation ("only ... to talk to you about the beta"), but the submit path also stores marketing-attribution data the applicant never sees: `from_cta` (which button they clicked), `utm_source/medium/campaign/term/content` and the referring host, captured on first page view into `sessionStorage` (`attribution.tsx:11-33`) and injected into the form at submit time (`signup-form.tsx:71-72`). Beyond the form, every page view is sent to Vercel Web Analytics and Speed Insights (LEG-008) and Vercel's runtime logs retain request IPs; none of that is mentioned. Marketing-attribution profiling is a different purpose from "talking to you about the beta", so the one privacy sentence on the site is inaccurate. Under FTC Act s.5 a specific, false data-use representation is the classic deception fact pattern; under GDPR it fails purpose-specification and transparency.
- Evidence: `actions.ts:82-88`: `from_cta: clip(text(fd, "from")...)`, `utm_source: clip(text(fd, "utm_source"), LIMITS.utm)`, ..., `referrer: clip(text(fd, "referrer"), LIMITS.referrer)`; migration comment: `'Which call to action sent them: the ?from= value on /beta.'`; `.env.example` and README: PostHog planned ("TODO: no PostHog project exists yet"). Mismatches, itemised: (a) attribution fields stored; (b) Vercel Analytics/Speed Insights beacons on every page (live `/_vercel/insights/script.js` 200, `/_vercel/speed-insights/script.js` 200); (c) server logs with IP at Vercel (SUSPECTED, standard platform behaviour); (d) planned PostHog with cookie persistence (not live today, LEG-008); (e) duplicate applications are silently discarded (23505 path, `actions.ts:97-98`) while the UI says "Application saved", so "We read your application. Every one, properly." is not literally true for re-applicants.
- Suggested fix: Either drop attribution capture from the form, or change the sentence to something honest and link a privacy policy: e.g. "We use this to talk to you about the beta, and we note which link brought you here. Privacy." Disclose Vercel analytics in the policy.
- Effort: S

### LEG-003 Google sign-in in production needs a privacy policy on the consent screen and on the homepage; button/logo do not follow Google's branding guidelines
- Severity: High
- Status: NEEDS MANUAL CHECK (Google Cloud Console state not visible)
- Location: `app/app/login/login-form.tsx:38-43` (button), `:85-93` (inline "G" mark), `app/app/login/actions.ts:35-46`; `README.md:58-60` ("Google provider ... will fail until it's done").
- What's wrong and why it matters: Google's OAuth consent screen for an app in "Production" with external users requires an app homepage, a privacy policy URL, and (for verification) that the privacy policy be linked from the homepage. Without verification the consent screen shows the "Google hasn't verified this app" interstitial and the app is capped at 100 users; with no privacy policy at all (LEG-001) verification cannot be completed. Separately, Google's "Sign in with Google" branding guidelines allow the text "Continue with Google" but require the official button assets or a button built to spec (G logo on its own tile with fixed padding, approved light/dark/neutral themes, no altered logo). Here the "G" is a hand-traced 18x18 path at 16px inside the site's own outlined `ctaSecondary` button on a near-black background. This is a guideline (brand) issue, not a legal one, but Google can enforce it through the OAuth review.
- Evidence: `login-form.tsx:41`: `Continue with Google`; `:85-93`: `<svg aria-hidden viewBox="0 0 18 18" className="size-4"> <path fill="#4285F4" ...>` (four Google-palette paths drawn by hand); README says the provider is not yet configured ("Magic links work without this; the 'Continue with Google' button will fail until it's done") so the live button may currently redirect to `/app/login?error=google` ("Google sign-in didn't come back").
- Suggested fix: Publish the privacy policy first (LEG-001), add it to the consent screen, and use Google's official button markup/asset or match the published spec; alternatively hide the Google button until the provider is configured and verified.
- Effort: S (button) / M (verification)

### LEG-004 Athlete performance and location data is uploaded by coaches about people who never consent, including likely minors, with no DPA, retention or deletion terms
- Severity: High
- Status: SUSPECTED (assessment; depends on who the beta crews are)
- Location: `app/page.tsx:299` ("High school, college and club coaches, and their crews."); `app/app/(dash)/force/actions.ts:112-202` (stores `seat_number`, `device_id`, per-stroke `peak`, `impulse`, `rise_rate`... per seat, plus raw files in Storage); `supabase/migrations/20260922183932_vieve_gps.sql:18-35` (`gps_points` lat/lon/speed/heading); `lib/session/vieve.ts:10-16`; `app/app/(dash)/cox/actions.ts:7-15` (per-seat side, i.e. a stable seat identity).
- What's wrong and why it matters: The dashboard is designed to hold longitudinal per-seat force data ("Seat by seat, over time", `force/page.tsx:91-94`) and, once Vieve ships, 10 Hz GPS tracks of a crew's outing. Seat numbers plus a coach's boat/date labels identify individual rowers within a programme. Assessment by regime: (1) FERPA: if a public school or college coach uploads data about enrolled students, the records may be "education records" maintained on behalf of the institution; a vendor is normally covered only as a "school official" under a written agreement giving the school direct control, with use limited to the school's purpose. There is no agreement, no institutional account concept (teams are auto-created from the coach's personal login, `force/actions.ts:15-29`), and no deletion path (LEG-006). (2) SOPIPA-style state student-privacy laws (California SOPIPA and roughly twenty similar state "operator of a K-12 site/service" laws): the site is explicitly marketed to high-school coaches, which is arguably "designed and marketed for K-12 school purposes"; those laws require reasonable security, prohibit targeted advertising/profiling with student data, and require deletion on school request. (3) COPPA: under-13 rowers are unlikely but not excluded (LEG-013). (4) GDPR/UK GDPR for any non-US crew: the coach would be a controller and RowTech a processor without an Art. 28 contract; location data of minors is high-risk under Art. 35. (5) Athletes themselves never see a notice or consent; the beta form's "crews" language treats them as the coach's data. (6) GPS tracks reveal where a crew trains, which for school crews is child location data.
- Evidence: `force/actions.ts:23`: team name built from the coach's email local part (personal login, no institution); `:145-146`: `device_id: meta.deviceId, session_uuid: meta.uuid`; `:166-181` per-stroke rows; `:196-201` raw files stored under `${team}/${row.id}/`; `cox/[id]/page.tsx:58-63` reads up to 20,000 GPS points per outing; no `retention`, `purge`, or `delete account` code in `app/`, `lib/`, or migrations (`grep -n -i 'retention'` returns nothing).
- Suggested fix: Before onboarding any school crew: publish dashboard terms + a data-processing addendum for institutions (purpose limitation, no secondary use, deletion on request, breach notice), add per-team deletion and export, and add an "athletes were told/consented" attestation in the upload flow or the beta onboarding. Consider not collecting GPS until the policy exists.
- Effort: L

### LEG-005 Anyone can create an account by typing an email; no terms accepted, no notice, no age check
- Severity: Medium
- Status: CONFIRMED
- Location: `app/app/login/actions.ts:20-33` (`shouldCreateUser: true`), `app/app/login/login-form.tsx:51-79`, `app/app/(dash)/request-access.tsx`.
- What's wrong and why it matters: Submitting any address on `/app/login` creates a Supabase `auth.users` row (email, timestamps, IP in auth logs) even for people who never applied and will never be allowed in. Nothing tells them an account is being created, what happens to the address, or how to delete it. Supabase's default magic-link sender is a no-reply address, so the request-access copy "Reply to our email" (`request-access.tsx:30`) points nowhere for these users.
- Evidence: `actions.ts:24-27`: `sb.auth.signInWithOtp({ email, options: { emailRedirectTo: ..., shouldCreateUser: true } })`; `login-form.tsx:23-24`: "We sent a sign-in link to {email}. It works once, and only for a short while." (no notice of account creation).
- Suggested fix: Either set `shouldCreateUser: false` and create users only when they are added to `allowed_users`, or add a one-line notice + privacy/terms link under the login form and a contact for deletion.
- Effort: S

### LEG-006 No data-deletion or export path for anyone: applicants, account holders, coaches' sessions, or athletes
- Severity: Medium
- Status: CONFIRMED
- Location: `app/app/(dash)/force/actions.ts:210-219` (`deleteSession` exists but is not called from any component); `app/beta/actions.ts` (no delete); no account-deletion action; no contact address (LEG-007).
- What's wrong and why it matters: `deleteSession` is defined but `grep -r deleteSession app components` finds no caller, so even a coach cannot delete an uploaded session from the UI. There is no way to delete an account, withdraw a beta application, or for an athlete to ask for their seat data to be removed. CCPA/CPRA (if thresholds are ever met), GDPR Art. 17, SOPIPA (deletion on school request) and Google's API Services User Data Policy (for OAuth apps) all expect a deletion route; more practically, a beta applicant who wants out has no address to write to.
- Evidence: `grep -r -n 'deleteSession' app components | grep -v 'export async function'` returns nothing; `grep -r -n -i 'mailto:|contact' app components lib` returns nothing.
- Suggested fix: Wire `deleteSession` to a confirm button on `/app/force/[id]`, add "delete my account" (Supabase admin API or a request path), and publish a contact email for deletion/export requests in the privacy policy.
- Effort: M

### LEG-007 No business identity, jurisdiction or contact channel anywhere on the site
- Severity: Medium
- Status: CONFIRMED
- Location: `components/site/site-footer.tsx:24` ("© {year} RowTech"); `app/page.tsx:107-119` (`Organization` JSON-LD with `name`, `url`, `logo`, `description` only); `app/beta/signup-form.tsx:21-23` ("We get in touch by email."); `app/app/(dash)/request-access.tsx:30` ("Reply to our email"); `app/beta/actions.ts:33-37` (confirmation email is a no-op stub).
- What's wrong and why it matters: There is no email address, postal address, legal entity name (LLC/Inc/Ltd), country, or contact page in the repo or in any of the five live pages (grep for `mailto:`, email-shaped strings, `LLC`, `Inc` over the fetched HTML returns nothing). The copy repeatedly promises email contact ("We get in touch by email", "Reply to our email") while the only outbound email in the code is the Supabase auth mail; the beta confirmation is `void application;`. Consequences: (1) no way for a data subject or a school to exercise rights; (2) GDPR Art. 13(1)(a) controller identity missing for EU/UK applicants; (3) the `Organization` schema has no `address`/`contactPoint`/`sameAs`; (4) an unincorporated "RowTech" collecting data and promising discounts (LEG-009) exposes the founders personally. Note: the task brief expected founders to be named in the JSON-LD; on `main` the `Organization` block names nobody (`app/page.tsx:110-117`).
- Evidence: `signup-form.tsx:22`: `{ t: "We get in touch by email.", d: "To talk through your boat, your rigging, your schedule and what you want to see." }`; `actions.ts:33-37`: `async function sendConfirmation(...) { // TODO: send confirmation email ... void application; }`; `request-access.tsx:30`: "Already applied, or already rowing with us? Reply to our email and we'll sort it out."
- Suggested fix: Add a contact email (at minimum) to the footer, the beta confirmation screen, the request-access page and the JSON-LD `contactPoint`; state the legal entity and country in the footer or on `/terms`.
- Effort: S
### LEG-008 Analytics beacons run on every page with no disclosure or consent; PostHog (if enabled later) would set a cookie
- Severity: Medium
- Status: CONFIRMED (Vercel scripts enabled live); PostHog: CONFIRMED not enabled in production today
- Location: `app/layout.tsx:65-66` (`<Analytics />`, `<SpeedInsights />` unconditional); `lib/analytics.ts:22-30` (`persistence: "localStorage+cookie"`, `capture_pageleave: true`, host `https://us.i.posthog.com`); `components/site/attribution.tsx:11-33` (`sessionStorage` key `rt_attr`); `components/site/analytics.tsx` (`$pageview`, `section_in_view`, `cta_click` events).
- What's wrong and why it matters:
  1. Vercel Web Analytics and Speed Insights are enabled on the live project: `GET /_vercel/insights/script.js` 200 (2,054 B) and `/_vercel/speed-insights/script.js` 200 (4,746 B). Vercel's docs describe Web Analytics as cookieless, identifying visitors by a hash of incoming request attributes (IP + User-Agent) that is not persisted beyond a session; Speed Insights sends route, web vitals, connection type and device class. Vercel's position is that no consent banner is required; EU regulators have not uniformly accepted "hashed IP" as anonymous. At minimum this needs a sentence in a privacy policy. Nothing on the site mentions it.
  2. PostHog: no `phc_` key appears in any of the 32 JS chunks served with the home page (`grep -l -E 'phc_[A-Za-z0-9]{20,}' chunks/*` = 0), so `analyticsEnabled` is false in production and `posthog-js` is never downloaded (CONFIRMED). If the key is ever set, the configured persistence `localStorage+cookie` sets a first-party cookie, sends data to a US host, and captures page-leave, all of which require prior consent for EU/UK visitors under ePrivacy Art. 5(3) and an opt-out notice for California. No consent mechanism exists in the code.
  3. First-touch attribution writes UTM values and the referrer host to `sessionStorage` on every first page view (`attribution.tsx:27`). It is first-party, tab-scoped and contains no identifier, so risk is low, but under the EDPB/CNIL reading of ePrivacy it is still storage that is not strictly necessary for the service the visitor requested (it exists to profile the lead), so it belongs in the disclosure.
  4. Fonts: self-hosted. Live HTML references `/_next/static/media/21ca8f3f56c22ca2-s.p....woff2` and `/_next/static/media/387ee14c0e0fe675-s.p....woff2`; no `fonts.googleapis.com`/`fonts.gstatic.com` host appears in any fetched page (CONFIRMED). No third-party script or connect hosts appear in the HTML of any of the five pages (only `www.rowtech.app`, `schema.org`, `www.w3.org` as xmlns); the Vercel scripts are injected at runtime from the same origin.
  5. Supabase auth cookies on `/app/*` are strictly necessary and need no consent, but should be listed.
- Evidence: `curl -w %{http_code}` results above; `lib/analytics.ts:29`: `persistence: "localStorage+cookie"`; `README.md:22`: "No project exists yet. With the key unset, posthog-js is never downloaded and no events are sent."
- Suggested fix: Add an analytics section to the privacy policy now (Vercel Analytics + Speed Insights + sessionStorage attribution + Supabase auth cookies). Before enabling PostHog: gate `startAnalytics()` behind a consent signal for non-US visitors (or use `persistence: "memory"`/`localStorage` only and an EU host), and add a cookie notice.
- Effort: S now / M for PostHog

### LEG-009 Beta promises ("Discounted prices on all RowTech products", "Testing units, for now", "$499 target price") have no terms and contradict the product brief
- Severity: Medium
- Status: CONFIRMED
- Location: `app/page.tsx:308-313`; `app/vieve/page.tsx:29-30` ("The target price is $499."); `lib/specs.ts:23` (`["Target price", "$499"]`); `PRODUCT.md:29-30` ("applying costs nothing and commits to nothing", "Nothing specific is promised to beta testers").
- What's wrong and why it matters: "Discounted prices on all RowTech products" is an unconditional, unlimited, undated promise to every beta crew. It has no definition of discount, no duration, no product scope, and no conditions (e.g. completing the beta). If RowTech later sells at list price to a former beta crew, that is a straightforward deceptive-representation/UDAP complaint, and it is exactly what `PRODUCT.md` says the site must not do. "Testing units, for now" implies hardware will be provided but says nothing about ownership, return, damage, liability on the water, or data obligations; a lent electronic device clamped to a rigger carries product-liability exposure with no waiver or terms. "$499" is properly hedged as a "target", but it sits in the H1 lead of `/vieve` and in a spec table, and a `Product` JSON-LD exists for Force (`app/force/page.tsx:31-41`) with no `offers`; no refund, cancellation, or auto-renewal terms exist because there are no payments (CONFIRMED: no Stripe/checkout code), which is fine today but the pricing language is ahead of the commercial terms. The site is pre-commercial and should say so where prices appear.
- Evidence: `page.tsx:310-312`: `<li>Testing units, for now</li> <li>A direct line to the people building it</li> <li>Discounted prices on all RowTech products</li>`; `vieve/page.tsx:30`: "The target price is $499."; `PRODUCT.md:30`: "Nothing specific is promised to beta testers."
- Suggested fix: Rewrite the third bullet as a conditional intention ("We plan to offer beta crews a discount when Force goes on sale") or remove it; add a short beta-programme terms page covering loaned units; keep "target" wording on every price.
- Effort: S

### LEG-010 Marketing-claims inventory: most claims are hedged well; a handful are absolute or imply on-water validation that the repo does not evidence
- Severity: Medium
- Status: CONFIRMED (inventory); individual items as marked
- Location: `app/page.tsx`, `app/force/page.tsx`, `app/vieve/page.tsx`, `lib/specs.ts`, `components/site/curve-explorer-model.ts`, `components/site/device-notes.ts`, `components/site/cox-box-view.tsx`, `components/device/force-screen.tsx`, `public/og.png`.
- What's wrong and why it matters: The "honest claims" pass (commit dac438c) shows: calibration status, raw sensor units, "concept design", "In development", "Example data", "target", and "So far it has only run on a made-up sample session" are all stated plainly. Under the FTC's substantiation standard the remaining risk is in (a) absolute words, (b) precision presented as accuracy, (c) depictions of capabilities that do not exist, and (d) an implication of on-water use with no evidence in the repo. Classification of every quantitative or capability claim:

  | # | Claim (location) | Class | Note |
  |---|---|---|---|
  | 1 | "records the force curve of every stroke" (hero, force lead, layout description) | Substantiated by firmware feature list (`page.tsx:68-74`) and demo parser; firmware itself not in repo | NEEDS MANUAL CHECK against LoadCellNode firmware |
  | 2 | "80 samples a second" (`specs.ts:7`); "Samples arrive every 12.5 ms" (`curve-explorer-model.ts:39`) | Substantiated internally (demo `sample_rate: 79.94`; 1/80 s = 12.5 ms) | firmware not in repo |
  | 3 | "Catch timing: placed on the node to within about 3 ms, interpolated between samples" (`specs.ts:8`, `model.ts:38-39`) | Hedged ("about") but it is an interpolation precision, not a tested accuracy; "That precision is what makes crew timing possible" is forward-looking | At risk if read as measured accuracy; say "interpolation resolution" |
  | 4 | "Calibration: up to 5 points; reports its own worst-case error. Not yet run on a node" (`specs.ts:9`, `force/page.tsx:27`) | Hedged appropriately | good |
  | 5 | "Timing is measured on the node itself, and it doesn't need calibration" (`page.tsx:103, 245-246`) | Reasonable (MCU time base) | fine |
  | 6 | "Each node finds every catch and release on its own" (`page.tsx:28`); "The node measures all of it on every stroke" (`page.tsx:191`) | Absolute ("every") for a threshold detector that also records `curve_valid=false` strokes and `dropped_samples: 4` in its own demo meta | Low risk; soften to "each catch and release" |
  | 7 | "Its own WiFi network; download from any phone or laptop" (`specs.ts:13`); "There's no app to install" | Absolute ("any") | Low; "from a phone or laptop" |
  | 8 | "3.5″ 480×320 TFT", "Keys VIEW, TARE, POWER", "3000 mAh", "50 kg load cell", "Adafruit Feather ESP32-S3 and an HX711 breakout on a RowTech carrier board" (`specs.ts:6-15`) | Parts list; hardware dir `hardware/force-carrier-v1` (KiCad, untracked) corroborates a carrier board exists | "The case is a concept design" hedges the enclosure only; battery life is not claimed (good) |
  | 9 | "What the rower sees on the water." (`force/page.tsx:59`); `PRODUCT.md:23` "measured on the water" | Implies on-water use; the repo has no on-water session, only a synthetic one ("made-up sample session", `page.tsx:251`) | NEEDS MANUAL CHECK: has a node been rowed? If not, "What the rower sees" is enough |
  | 10 | Hero/step-2 device screen shows "VIEVE" link indicator lit green, "78%" battery, "61.4 kg", "avg 10 62.4" (`force-screen.tsx` defaults `linked = true`, `battery = 78`; baked into `public/og.png`) | Depicts a Vieve link (product in development) and calibrated kg values (no node calibrated); captioned "Force node, concept design." only | Low/Medium: the screen mock shows capabilities that do not exist; PRODUCT.md:30 acknowledges "they are the design, not photographs" but the page does not say the link status is illustrative |
  | 11 | "Example stroke ... in kilograms as a calibrated node will read" (`scope-strip.tsx:81`); "Example data." (`curve-explorer-view.tsx:283`); "Illustration of the crew view" (`crew-lanes.tsx:123`) | Hedged appropriately | good |
  | 12 | Vieve specs "5″, 1000 nits", "u-blox MAX-M10S, 10 Hz", "5000 mAh" (`specs.ts:19-22`, `device-notes.ts:106-115`) | Stated as facts for a product "In development" whose case is "a concept design"; parts may be selected but the product does not exist | Low: prefix with "Planned" |
  | 13 | "Crew link: target of every seat within 5 ms" (`specs.ts:21`, `cox-box-view.tsx:60-61`) | Hedged ("target") | good |
  | 14 | "Target price $499" (`specs.ts:23`, `vieve/page.tsx:30`) | Hedged | see LEG-009 |
  | 15 | "Vieve will carry the cox's voice ... upload the outing over WiFi once you're ashore" (`device-notes.ts:115`) | Future tense | good |
  | 16 | "In beta." (footer, Force JSON-LD "In beta."); "We're choosing beta crews now."; "Testing units, for now" | Status claims; "beta" is generous when no node is calibrated and the dashboard has only seen synthetic data, but the page says so | Info |
  | 17 | "Making imperative data available to everyone" (`hero.tsx:19`) | Puffery; "everyone" vs "For high school, college and club coaches" one line later | see CNT-001 |
  | 18 | "Discounted prices on all RowTech products" | Unsubstantiated promise | LEG-009 |
  | 19 | `Organization` JSON-LD: no founders named, no address, no contact (`app/page.tsx:107-119`) | Info | consistent with LEG-007 |

- Evidence: quotes above; `force-screen.tsx:65-77`: `battery = 78, linked = true`; live home text extraction shows "VIEVE" on the hero screen; `public/og.png` viewed: hero with "61.4 kg" screen, "VIEVE 78%".
- Suggested fix: Soften "every"/"any"; relabel 3 ms as interpolation resolution; add "Planned" to Vieve parts; add one clause to the hero caption ("screen shows the design, including the Vieve link") or draw the hero screen unlinked; confirm whether any on-water session exists before keeping "on the water".
- Effort: S

### LEG-011 Accessibility as legal exposure (policy level only)
- Severity: Medium
- Status: SUSPECTED (assessment; technical testing is the a11y agent's)
- Location: whole site; no accessibility statement anywhere; no `not-found.tsx`.
- What's wrong and why it matters: A US commercial site selling to the public is routinely treated by plaintiffs' firms and DOJ as a "place of public accommodation" under ADA Title III (state analogues: California Unruh, NY). More specifically to this product: the customers are public high schools, colleges and clubs. The DOJ's 2024 Title II web rule requires state and local government entities (public schools/colleges) to make the web content and mobile apps they provide, including through vendors, conform to WCAG 2.1 AA; the compliance date for entities serving 50,000+ people was 24 April 2026 (already past on the audit date), smaller entities 2027. Public programmes will increasingly ask for a VPAT/ACR before adopting a dashboard. The site's own a11y work (skip links, aria labels, keyboard 3D controls) is visible in the code, which helps, but nothing documents it.
- Evidence: `grep -r -i 'accessibility' app components` returns nothing user-facing.
- Suggested fix: Publish a short accessibility statement (target WCAG 2.1 AA, contact for issues) and keep an internal conformance checklist so a VPAT can be produced for institutional customers.
- Effort: S

### LEG-012 International applicants are invited, but no controller identity, lawful basis or transfer information is given
- Severity: Low
- Status: SUSPECTED
- Location: `app/beta/signup-form.tsx:204` (`placeholder="City, country"`); `lib/analytics.ts:11` (`https://us.i.posthog.com`); Supabase/Vercel regions unknown.
- What's wrong and why it matters: The location field's placeholder assumes applicants outside the US. For an EU/UK applicant, GDPR Art. 13 requires identity of the controller, purposes, legal basis, recipients (Supabase, Vercel, Google), international transfers, retention and rights, none of which exist (LEG-001, LEG-007). Which region hosts the Supabase project and the Vercel functions is not visible from the repo (`.env.example` has no project ref).
- Evidence: placeholder quoted; `README.md:14-23` (env table) gives no region.
- Suggested fix: Cover in the privacy policy; record the Supabase region and Vercel function region; if EU crews are wanted, note SCC/DPF reliance for Supabase/Vercel/Google.
- Effort: S

### LEG-013 No age gate or age statement; "Athlete" applicants may be minors
- Severity: Low
- Status: CONFIRMED (gap) / SUSPECTED (exposure)
- Location: `app/beta/fields.ts:3-8` (`{ value: "athlete", label: "Athlete" }`); `app/page.tsx:299`.
- What's wrong and why it matters: The form accepts an individual "Athlete" applying for a beta aimed at high-school programmes, collecting name, email, location and free text. Under-13 rowers are rare but not excluded, and 13-17-year-olds trigger state rules (e.g. California's opt-in for minors under 16 for any future "sale/sharing", and the general COPPA practice of not knowingly collecting from under-13s). There is no "You must be 18, or have a coach/parent apply for you" line.
- Evidence: no `age`, `birth`, `18`, or `parent` string in `app/beta/*`.
- Suggested fix: Add "If you're under 18, ask your coach or a parent to apply for you." under the role chips, and say so in the privacy policy.
- Effort: S

### LEG-014 Open-source licences: all permissive, but the served bundles strip every attribution notice
- Severity: Low
- Status: CONFIRMED
- Location: `package.json` dependencies; live `/_next/static/chunks/*.js`.
- What's wrong and why it matters: Licence scan of `node_modules` (read-only script, 703 packages): 589 MIT, 40 ISC, 34 Apache-2.0, 13 BSD-2, 12 BSD-3, 3 MPL-2.0, 2 BlueOak, 1 CC-BY-4.0, 1 CC0, 1 0BSD, 1 Python-2.0, and one flag: `@img/sharp-win32-x64@0.34.5` = "Apache-2.0 AND LGPL-3.0-or-later" (the prebuilt libvips binary used by `sharp` for build-time image optimisation on this Windows machine; dynamically linked, never shipped to browsers, no obligation for a hosted deployment beyond not modifying libvips). `webgl-constants@1.1.1` has no `license` field in `package.json` but ships an MIT `LICENSE` (via `detect-gpu`, via `@react-three/drei`). No GPL/AGPL/SSPL anywhere. Key runtime deps: three MIT, maplibre-gl BSD-3-Clause, lucide-react ISC, shadcn MIT, @base-ui/react MIT, @react-three/fiber and drei MIT, fflate MIT, posthog-js Apache-2.0 AND MIT, @vercel/analytics MIT, @vercel/speed-insights Apache-2.0, next MIT. For a closed-source hosted site these impose no source-disclosure obligation; the only obligation (MIT/ISC/BSD: keep the copyright notice with copies; Apache: keep NOTICE; BSD-3: no endorsement) is attribution. The 32 chunks served with the home page contain zero `@license`/`Copyright` comments (`grep -l -E '@license|Copyright \(c\)|Licensed under' chunks/*` = 0 of 32), i.e. Turbopack's minifier drops them, as most production bundlers do. Industry practice tolerates this, but the strict reading is that the notices should be reproducible somewhere.
- Fonts: Archivo and Chivo Mono (both Omnibus-Type, Google Fonts) are SIL Open Font License 1.1. `next/font/google` fetches them at build time and self-hosts the woff2 (CONFIRMED live at `/_next/static/media/...woff2`); OFL permits embedding and self-hosting without attribution on the page; the OFL text is only required to travel with redistributed font files, which is not the case here.
- Evidence: script output summarised above; `node_modules/three/LICENSE`: "The MIT License Copyright © 2010-2026 three.js authors"; `node_modules/lucide-react/LICENSE`: "ISC License"; `node_modules/maplibre-gl/LICENSE.txt`: BSD-3.
- Suggested fix: Add a `/licenses` (third-party notices) page generated from `node_modules` at build time, or enable licence-comment preservation; nothing else is required.
- Effort: S

### LEG-015 Ownership of the "Vieve V1 + Force, concept A" concept sheets and the site's derivative renders is undocumented
- Severity: Low
- Status: NEEDS MANUAL CHECK
- Location: `components/device/force-device.tsx:7`, `vieve-device.tsx:6`, `force-screen.tsx:4`, `vieve-screen.tsx:6`, `screen-theme.ts:3`, `components/device/force-mount.tsx:3` ("after the mounting sheet in 'Vieve V1 + Force'"); `PRODUCT.md:30` ("after 'Vieve V1 + Force, concept A' (2026-09-22)"); `components/device3d/*` (3D models); `public/og.png`.
- What's wrong and why it matters: Every device drawing, screen mock, 3D model and the OG image are declared derivative works of a dated concept sheet. If that sheet was produced by an external industrial designer or agency without a written assignment or licence covering derivative works and web use, RowTech's copyright in the site's most prominent imagery is unclear. `public/og.png` itself is a render of the site's own hero (created in-repo, commits fb72043 → 90aa943), so it is owned to the extent the underlying drawings are. No trademark clearance for "RowTech", "Vieve" or "Force" is evidenced in the repo either (cannot be checked offline).
- Evidence: comments quoted above; `git log --oneline -- public/og.png`: 90aa943, dac438c, fb72043.
- Suggested fix: Record who made the concept sheets and, if external, get a written assignment or a licence covering derivative works and marketing use. Run a USPTO/EUIPO knock-out search for "Vieve" and "RowTech" in class 9/28 before printing anything.
- Effort: S

### LEG-016 Third-party marks in specs (nominative use) and "WiFi" spelling
- Severity: Info
- Status: CONFIRMED
- Location: `lib/specs.ts:7, 13, 20`; `components/site/device-notes.ts:61, 115`.
- What's wrong and why it matters: "Adafruit Feather ESP32-S3", "HX711", "u-blox MAX-M10S" are used descriptively to name parts, which is classic nominative fair use and fine. "WiFi" (10 occurrences) is the Wi-Fi Alliance's certification mark spelled "Wi-Fi"; using the mark to describe an uncertified product's radio is tolerated in practice, but the correct spelling avoids the question and matches AP/Chicago style (see CNT-008).
- Evidence: `grep -o -E 'Wi-?Fi' home.html`: 9 × "WiFi", 0 × "Wi-Fi".
- Suggested fix: Spell "Wi-Fi"; keep part names as-is.
- Effort: S

### LEG-017 Stale-deploy check: `/team` now 404s live and no live page links to it (mismatch resolved); the 404 page is Next's unbranded default with two `<title>` elements
- Severity: Info
- Status: CONFIRMED
- Location: live `/team` (HTTP 404, 12,927 B); `git log -- app/team/page.tsx lib/team.ts`: removed in aba1b1a (HEAD); `tests/marketing.spec.ts:60` asserts the "Who we are" link is gone.
- What's wrong and why it matters: the audit brief recorded `/team` as 200 at the start of the audit; at fetch time (2026-09-24 ~15:30 UTC, `X-Vercel-Id: cle1::iad1::...`) it returns 404 and none of `/`, `/beta`, `/force`, `/vieve`, `/app/login` contain `href="/team"`. So the live deploy now matches `main`; no stale header/footer link remains. The 404 body is Next's default ("404: This page could not be found.") with no header, footer or way back, and the HTML carries two `<title>` tags (`404: This page could not be found.` followed by the site title), which is the framework fallback, not a branded page (see CNT-011).
- Evidence: `curl` codes above; `grep -o 'href="/team[^"]*"' *.html` empty for all five pages; `grep -o '<title>[^<]*</title>' team.html` returns two titles.
- Suggested fix: None for the mismatch; add `app/not-found.tsx` (CNT-011).
- Effort: S

### LEG-018 Team name is derived from the user's email; beta duplicates are silently discarded
- Severity: Info
- Status: CONFIRMED
- Location: `app/app/(dash)/force/actions.ts:23`; `app/beta/actions.ts:97-98`.
- **[Lead note]** The de-duplication is real: `beta_signups_email_key` is a live unique index on `lower(email)` (LEAD-005), so the 23505 branch fires and re-applications are dropped.
- What's wrong and why it matters: The team name stores a fragment of the login email (`email.split("@")[0]` + "'s crew"), i.e. personal data derived without notice and visible to future team members. The beta insert treats unique-violation 23505 as success so re-applications (with possibly updated boats/message) are dropped without telling the applicant; the UI still says "Application saved" (CNT-013). Both are minor but belong in the privacy policy / UX.
- Evidence: lines quoted.
- Suggested fix: Ask for a team name on first upload; on duplicate, show "We already have an application from this address" or upsert the row.
- Effort: S

---
#### PART B: FORMATTING & CONTENT

### CNT-001 Hero headline: "imperative data" is a malapropism and "everyone" contradicts the next line; the headline is baked into og.png
- Severity: Medium
- Status: CONFIRMED
- Location: `components/site/hero.tsx:19` ("Making imperative data available to everyone, seat by seat."), `:27` ("For high school, college and club coaches."); `public/og.png` (rendered headline); `app/layout.tsx:26-27` (`<title>` "RowTech: the force curve from every seat in the boat"); `tests/marketing.spec.ts:6` (asserts "seat by seat").
- What's wrong and why it matters: "Imperative" means commanding/obligatory; "imperative data" is not idiomatic ("essential", "the data that matters", "crucial" were probably intended) and reads as a typo to a coach. "to everyone" is contradicted one line down ("For high school, college and club coaches") and by `PRODUCT.md:44` ("Coaches first"). The site now has three different one-liners: the H1, the `<title>`/OG title ("the force curve from every seat in the boat") and the OG/footer description ("Seat-by-seat force measurement for rowing"). The H1 is the weakest of the three and it is the one that was screenshotted into `public/og.png`, so a copy fix also requires regenerating the OG image.
- Evidence: live home text: "Making imperative data available to everyone, seat by seat."; `og.png` viewed: same headline rendered in the image.
- Suggested fix: Use the `<title>` line or the previous headline as the H1 (e.g. "The force curve from every seat in the boat."), keep the audience line, regenerate `og.png`, update the Playwright assertion.
- Effort: S

### CNT-002 Four words for the same thing: practice, outing, session, piece
- Severity: Medium
- Status: CONFIRMED
- Location: practice: `hero.tsx:22`, `app/page.tsx:32-33`, `app/force/page.tsx:51`; outing: `page.tsx:154`, `:250`, `app/app/(dash)/cox/page.tsx:39, 51`, `cox/[id]/page.tsx:80-82`; session: `page.tsx:73`, `specs.ts:14`, `force/page.tsx:49-52`, dashboard everywhere; piece: `cox/page.tsx:31-33`, `:67`, `cox/compare/page.tsx:8, 99`, `force/upload-form.tsx:83`, `crew-panel.tsx:55`.
- What's wrong and why it matters: "Download the practice" (home), "How an outing gets from the rigger to your phone" (home, same page), "Sessions saved to microSD" (home), "Upload a node's four session files, or several seats at once as one outing" (home), "they land here as one piece" (dashboard), "What was the piece?" (upload form), "Crew outing" (list label), "Compare pieces" (page title). A coach reading in order meets four nouns for one object. In rowing they are not synonyms (a piece is a segment of an outing/practice), which makes the drift worse: the dashboard calls a whole upload a "piece". Related drift: node / seat node / Force node / Force (23 / 9 / 6 / product name) and hub / cox box / Vieve; dashboard tabs are product names ("Force", "Cox") while their H1s are "Sessions" and "Cox".
- Evidence: counts from `grep -o -i -w` over `app/page.tsx app/force app/vieve app/beta components/site`: outing 3, practice 4, session 8, piece 0; dashboard adds piece ×6.
- Suggested fix: Pick one noun for the recording unit (suggest "session" for files/dashboard, "outing" for the thing rowed) and one for a segment ("piece"), then sweep. Rename the "Cox" tab "Crew" or "Outings".
- Effort: S

### CNT-003 Direct contradictions and promises the UI cannot keep
- Severity: Medium
- Status: CONFIRMED
- Location: as listed.
- What's wrong and why it matters:
  1. `app/app/login/page.tsx:15`: "That link has expired or was already used. Here's a fresh one." No fresh link is issued; the user sees the empty form and must request one. Misleading.
  2. `app/app/(dash)/request-access.tsx:30`: "Already applied, or already rowing with us? Reply to our email and we'll sort it out." No email is ever sent to applicants (`app/beta/actions.ts:33-37` is a stub) and Supabase magic-link mail is no-reply.
  3. `app/beta/signup-form.tsx:39`: status line "Application saved" is shown for honeypot hits and duplicate addresses where nothing was saved (`actions.ts:54, 97-98`).
  4. `app/page.tsx:312` "Discounted prices on all RowTech products" vs `PRODUCT.md:30` "Nothing specific is promised to beta testers." (LEG-009).
  5. `app/page.tsx:250` "Upload a node's four session files" and `specs.ts:14` (four files) vs the step-3 illustration `components/site/session-files.tsx:9-13, 54` which shows and names three ("Strokes, Curves, Timing") and step-3 copy `page.tsx:33` listing three things; `meta.json` is the fourth.
  6. `app/force/page.tsx:61` "three keys down its edge" and `specs.ts:11` "VIEW, TARE, POWER" vs the 3D notes `device-notes.ts:76-93` which explain only VIEW and TARE; the POWER hint exists in `components/device/force-device.tsx:13` ("Hold to switch the node on or off.") but is not surfaced on `/force`.
  7. `signup-form.tsx:103` "Tell us more about your boats if you like." vs `:164` "Tell us about your boat" vs `:188` "Boats you row" (singular/plural).
  8. `page.tsx:304` "Which boats you row, where you are and a note are optional" omits the optional role question ("I'm a…", `signup-form.tsx:175`).
  9. `PRODUCT.md:27` says the CTA copy is "Interested? Contact us for beta testing." — that string exists nowhere in `app/`, `components/` or `tests/` (stale brief). `PRODUCT.md:15` describes an athlete section "lower on the page"; there is none.
  10. `page.tsx:138` "bow side and stroke side" vs dashboard `crew-panel.tsx:80` "Port and starboard" for the same axis.
- Evidence: quotes above; `grep -r -n 'Interested' app components tests` empty.
- Suggested fix: Rewrite (1) as "That link has expired or was already used. Enter your email for a new one."; (2) as "Already applied? Write to {email}" once a contact exists; (3) show "Application received"; (5) add meta.json to the illustration or say "three data files and a meta file"; (6) add a POWER note; harmonise (7)-(10).
- Effort: S

### CNT-004 Title template separator differs between the site and the dashboard
- Severity: Low
- Status: CONFIRMED
- Location: `app/layout.tsx:27` (`template: "%s | RowTech"`); `app/app/layout.tsx:6` (`template: "%s · RowTech"`).
- What's wrong and why it matters: Live `<title>`s: "Apply for the beta | RowTech", "Force, the seat node | RowTech" vs "Sign in · RowTech". Two separators in one product's tab strip. Also: `/app/login` and all dashboard pages have no `description`; fine for `noindex` pages, but the login page is reachable from the public site.
- Evidence: `grep -o '<title>[^<]*</title>'` over `beta.html`, `force.html`, `app_login.html`.
- Suggested fix: Use one separator (the middle dot matches the readout style used in the UI).
- Effort: S

### CNT-005 Straight vs curly apostrophes are mixed across copy; `&rsquo;`, literal `’` and `'` all appear, including side by side on the home page
- Severity: Low
- Status: CONFIRMED
- Location: counts over `app/`, `components/`, `lib/specs.ts` (comments excluded): 36 × `&rsquo;`, 24 × literal `’`, 19 × straight `'` inside user-facing strings, 4 × `&hellip;`, 1 × literal `…`.
- What's wrong and why it matters: Three encodings for one glyph is a maintenance hazard and produces visible inconsistency: the home page renders "who’s carrying the boat" (curly, `page.tsx:135`) a few sections above "the rower's recent peak" and "can't split one stroke into two" (straight, `curve-explorer-model.ts:39, 63`, rendered in the explorer body). All `<meta name="description">` strings use straight quotes (`app/layout.tsx:30` "each seat's", `app/force/page.tsx:14` "each seat's", `app/vieve/page.tsx:15` "the cox's voice to the boat's speakers") so search snippets differ from page copy. Every server-action error string uses straight quotes ("couldn't", "doesn't", "wasn't", `app/beta/actions.ts:61, 111`; `app/app/login/actions.ts:21, 30`; `app/app/(dash)/force/actions.ts:52, 72, 97, 107, 127, 161, 184, 200`), and `app/force/page.tsx:70` caption "It's wired to a 50 kg load cell". Ellipsis: `Sending&hellip;` / `Reading the session&hellip;` / `I&rsquo;m a&hellip;` vs literal "…" in `upload-form.tsx:68`. Dashes: no em/en dashes in prose anywhere (the copy uses colons and commas consistently, which is fine); "—" appears only as the empty-value placeholder in dashboard tables; `crew-lanes.tsx:112` correctly uses U+2212 minus for negative offsets.
- Evidence: script output in audit log; examples quoted.
- Suggested fix: Standardise on literal `’` and `…` in source (JSX handles them; `&rsquo;` entities are unnecessary) and fix the 19 straight ones, including metadata and error strings.
- Effort: S

### CNT-006 Terminal-period convention on headings is inconsistent between site and app
- Severity: Low
- Status: CONFIRMED
- Location: marketing H1/H2 end with a period ("Force, the seat node.", "Specifications.", "Apply for the beta.", "Questions a coach might ask."); H3s do not ("Who it's for", "Applying", "In the node's firmware now"); dashboard H1s do not ("Sessions" `force/page.tsx:49`, "Cox" `cox/page.tsx:29`, "Two pieces, side by side" `compare/page.tsx:99`); login H1 "Sign in" (`login/page.tsx:23`) no period but `request-access.tsx:14` "The dashboard is for beta crews." and `login-form.tsx:21` "Check your email." have one; upload form H2 "Upload a session" none.
- What's wrong and why it matters: Sentence-style headings with periods are a deliberate voice choice on the marketing pages; the app half-applies it, so the product feels like two products.
- Evidence: quoted.
- Suggested fix: Rule: full-sentence headings take a period, label headings do not; apply in `/app` and login.
- Effort: S

### CNT-007 Number, unit and label style drifts
- Severity: Low
- Status: CONFIRMED
- Location: `lib/specs.ts`, `components/site/device-notes.ts`, `components/site/curve-explorer-model.ts`, `components/site/curve-explorer-view.tsx`, `app/force/page.tsx`.
- What's wrong and why it matters, itemised:
  1. Same fact, different punctuation: spec "3.5″ 480×320 TFT" (`specs.ts:10`) vs note "3.5″, 480×320 TFT." (`device-notes.ts:52`); spec "5″, 1000 nits" vs note "5″, rated at 1000 nits."
  2. Words vs numerals on one page: "up to five known weights" (`force/page.tsx:27`) vs "Up to 5 points" (`specs.ts:9`).
  3. Spec cell mixes a full stop mid-cell with none at the end: "Up to 5 points against known weights; reports its own worst-case error. Not yet run on a node" (`specs.ts:9`).
  4. Rate units: "80 samples a second" (`specs.ts:7`) vs "10 Hz" (`specs.ts:20`); "28.4 spm" (`curve-explorer-view.tsx:70`) vs "strokes a minute" (`scope-strip.tsx:85`, `model.ts:69`).
  5. Percent spacing: "33 / 47 / 19 %" (`model.ts:56`) vs "CV 1.8%" and "at 36%".
  6. Label style: "Peak & position" (ampersand, `model.ts:49`) vs "Rate, drive and recovery times" (and); "Drive : recovery" with spaced colon (`history-panel.tsx:23`, `analyse.ts:74`, `compare/page.tsx:88`).
  7. The curve-explorer value column mixes measurements ("61.4 kg at 36%") with definitions ("½ threshold" for Release, `model.ts:62`).
  8. `upload-form.tsx:85` placeholder "4 x 750m, rate 28" (no space before m, letter x) vs "PIECE 2 · 2000 m" (`vieve-screen.tsx:63`); `:79` boat placeholder "Club VIII" (Roman) vs form chips "8+".
  9. `force-device.tsx:46` aria text says "3.5 inch screen" while visible text uses "3.5″" (fine for screen readers; noting for consistency of the source).
- Evidence: quoted.
- Suggested fix: One style sheet for specs: numerals for all specs, no terminal period in cells, "Hz" or "per second" but not both, "%" closed up.
- Effort: S

### CNT-008 "WiFi" should be "Wi-Fi"; other capitalisation conventions are consistent
- Severity: Low
- Status: CONFIRMED
- Location: `app/page.tsx:33, 86, 99, 156`; `app/force/page.tsx:22-23`; `lib/specs.ts:13`; `components/site/device-notes.ts:61, 115`; `components/site/session-files.tsx:2` (10 occurrences).
- What's wrong and why it matters: "WiFi" is consistent internally but is not the standard spelling (Wi-Fi Alliance, AP, Chicago, Apple, Google all use "Wi-Fi"). Checked and consistent: "microSD" (5 ×, correct), "cox box" lowercase (13 ×; `CoxBoxView`/`cox-box-view.tsx` are identifiers only), "Vieve" in prose with "VIEVE"/"FORCE" only as device labels on drawn screens and placeholders (acceptable as product-badge styling), "kg" in numerics with "kilograms" in prose (4 ×), acceptable. One genuine ambiguity: `page.tsx:103` "Timing ... doesn't need calibration. Force does:" — "Force" here is the quantity but, capitalised at sentence start next to a product named Force, reads as the product.
- Evidence: counts above.
- Suggested fix: Replace "WiFi" with "Wi-Fi" (10 places); rephrase to "Force readings do:".
- Effort: S

### CNT-009 Error-message inventory: mostly clear and on-voice; a few are misleading, mis-cased or leak raw database text
- Severity: Low
- Status: CONFIRMED
- Location: `app/beta/actions.ts:57-71, 111`; `app/app/login/actions.ts:21, 30`; `app/app/login/page.tsx:15`; `app/app/(dash)/force/actions.ts:45-80, 97-200`; `lib/session/vieve.ts:57`; `lib/session/parse.ts:26-176`.
- What's wrong and why it matters: Full list with judgement:
  - Beta: "Tell us your name." (good) / "Keep it under 120 characters." (good) / "We need an email address to reply to." (good) / "That doesn't look like an email address. Check for a typo." (good) / "Which club, school or program do you row with?" (good, question form differs from the others) / "Pick one of the options." / "Pick from the boats listed." (only reachable by tampering; fine) / "A couple of things need fixing before we can send this." (shown even when exactly one field is wrong) / "Something went wrong on our side and your application wasn't saved. Please try again in a minute." (the only "Please" on the site; tone drift).
  - Login: "That doesn't look like an email address." (drops "Check for a typo." that the beta variant has; harmonise) / "We couldn't send that link. Try again in a minute." (good) / "That link has expired or was already used. Here's a fresh one." (misleading, CNT-003) / "Google sign-in didn't come back. Try again, or use a link instead." (good).
  - Upload: "Sign in with a beta account to upload." / "That zip couldn't be opened." (returned for any `collect()` failure, including when no zip was uploaded, `force/actions.ts:52`) / "`${key}: that session couldn't be read.`" (when a single folder is uploaded `where` is empty so the message starts lowercase: "that session couldn't be read.", `:70-72`) / "Pick a session folder with meta.json and strokes.csv in it (curves.bin and events.csv too, if you have them), or a zip of one." (long but clear) / "We couldn't set your team up. Try again in a minute." / "The boat couldn't be saved: {raw Supabase error}", "The upload couldn't be saved: {raw}", "The session couldn't be saved: {raw}", "The strokes couldn't be saved: {raw}", "{name} couldn't be stored: {raw}" (`:107, 127, 161, 184, 200`: raw PostgREST/Storage error text is shown to the coach; tone break, and the security agent should note the information leak).
  - Format errors (`parse.ts`): "meta.json isn't valid JSON.", "strokes.csv is empty.", "strokes.csv line 12: expected 13 columns, found 12.", "curves.bin holds 140 curves but strokes.csv has 147 strokes." (technical but appropriate for a file-format audience; consistent voice).
  - Vieve: long explanatory sentence (`vieve.ts:57`), good.
  - Empty states: "Nothing here yet. Upload a session from a node and it lands here." / "No crew outings yet. Upload more than one seat together and they become one." / "No GPS track on this outing. The track, the split and the race line come from Vieve, the RowTech cox box." / "No GPS track: that comes from Vieve." (two phrasings for the same state, `crew-view.tsx:45` vs `compare/page.tsx:112`) / "This session has no strokes in it." / "The node didn't keep a curve for this stroke." / "Nothing picked" (`compare/page.tsx:107`). All fine.
- Evidence: quoted.
- Suggested fix: Wrap raw DB errors ("The session couldn't be saved. Try again, and tell us if it keeps happening."), capitalise the single-folder read error, make the "couple of things" line count-aware, drop "Please" or use it everywhere.
- Effort: S

### CNT-010 Synthetic demo session is publicly served but not linked; honesty line on the home page is good
- Severity: Low
- Status: CONFIRMED
- Location: `public/demo/seat-1..8/{meta.json,strokes.csv,curves.bin,events.csv}`; `scripts/make-demo-session.mjs`; `tests/app.spec.ts:46-49`; `app/page.tsx:251`.
- What's wrong and why it matters: `https://www.rowtech.app/demo/seat-1/meta.json` returns 200 (609 B) with `"device_id": "RowTech-7A3F22"`, `"git": "demo"`, `"fw": "v10.0.0"`, `"cal": {"valid": true, ...}`, i.e. a public, unlabeled file that claims a calibrated node (`cal.valid: true`, `units: "kg"`) while the site says no node has been calibrated. No live page links `/demo/` (`grep -r '/demo/' app components lib` empty; only the Playwright test uses the files), so a visitor would only find it by guessing, but crawlers and anyone reading the test can. The home page's "So far it has only run on a made-up sample session" (`page.tsx:251`) is admirably honest and should stay. Other placeholder-ish text visible to users: hero/step screens show "SEAT 5", "VIEVE 78%", "STROKE 147" (fictional but captioned as concept design); Vieve screen "PIECE 2 · 2000 m"; `DevicePlaceholder` shows "FORCE"/"VIEVE" letter-spaced labels until the island loads (and permanently with JS off; `aria-hidden`, fine). No "TODO"/"lorem" reaches the DOM (`grep -r -n 'TODO' app components` hits comments only: `beta/actions.ts:34`, `lib/session/vieve.ts:4, 64`).
- Evidence: `curl -w %{http_code}` = 200; meta.json content above.
- Suggested fix: Either move the fixture under `tests/fixtures/` (the test reads from disk, not over HTTP) or add a `"note": "synthetic sample"` field to the demo meta and mention it in the privacy/terms "sample data" line.
- Effort: S

### CNT-011 404 page is Next's default: unbranded, no navigation, duplicate `<title>`
- Severity: Low
- Status: CONFIRMED
- Location: live `/team`, `/privacy`, etc. (all 12,927 B identical body); no `app/not-found.tsx` in repo.
- What's wrong and why it matters: A visitor following the old "Who we are"/`/team` link from a cached page, or mistyping, gets "404: This page could not be found." in the framework's default styling with no header, footer or link home; the HTML contains two `<title>` elements. It is the one page on the site that does not sound like RowTech.
- Evidence: `grep -o '<title>[^<]*</title>' team.html` = "404: This page could not be found." and "RowTech: the force curve from every seat in the boat".
- Suggested fix: Add `app/not-found.tsx` using `SitePage` with one line and the two product links.
- Effort: S

### CNT-012 Literal "→" arrow in a link while every other link uses an icon component
- Severity: Low
- Status: CONFIRMED
- Location: `app/app/(dash)/cox/page.tsx:67` ("Compare two pieces →"); compare with `ArrowRight`/`ArrowLeft` lucide icons in `signup-form.tsx`, `login-form.tsx`, `cox/[id]/page.tsx:79`, `compare/page.tsx:96`.
- What's wrong and why it matters: Visual inconsistency and the arrow is read aloud as "rightwards arrow" by some screen readers.
- Suggested fix: Use `<ArrowRight aria-hidden className="size-3.5" />`.
- Effort: S

### CNT-013 Confirmation copy: "Application saved" and first-name greeting edge cases
- Severity: Low
- Status: CONFIRMED
- Location: `app/beta/signup-form.tsx:39-41` (`Application saved`; `Thanks, ${name.split(" ")[0]}.`).
- What's wrong and why it matters: "Application saved" is shown for duplicates and honeypot hits where nothing was saved (see LEG-018). `split(" ")[0]` greets "Coach Jones" as "Thanks, Coach." and "Dr. A. Smith" as "Thanks, Dr.."; a single-token name is fine. "We read your application. Every one, properly." then "No email from us yet? That's expected: we reply personally, not automatically." is fine on timing, but with no email address anywhere the applicant has no way to follow up (LEG-007).
- Suggested fix: "Application received"; greet with the full name or none.
- Effort: S

### CNT-014 Dashboard section labels, unknown-seat placeholders, and unpluralised "1 seats"
- Severity: Low
- Status: CONFIRMED
- Location: `app/app/(dash)/dash-nav.tsx:7-10` (tabs "Force", "Cox"); `force/page.tsx:49` (H1 "Sessions"); `cox/page.tsx:29` (H1 "Cox"); `force/[id]/page.tsx:59` and `cox/[id]/page.tsx:52` (`"seat ?"`); `force/page.tsx:67` (`Seat ${s.seat_number ?? "?"}`); `cox/[id]/page.tsx:85`, `force/page.tsx:67, 72, 76` (`${n} seats`, `${strokes} strokes` never singularised).
- What's wrong and why it matters: The "Force" tab lists every session including crew outings, and "Cox" is a cryptic H1 for "crew outings" (the page's own copy calls them "Outings with the whole crew in them"). "seat ?" / "Seat ?" is a debug-style label that reaches users when `seat_number` is null. "1 seats" / "1 strokes" can appear, while `upload-form.tsx:68` does pluralise "file/files".
- Suggested fix: Tabs "Sessions" and "Crew"; "Seat not set"; pluralise seats and strokes.
- Effort: S

### CNT-015 Header vs footer "beta" destinations differ under similar labels
- Severity: Info
- Status: CONFIRMED
- Location: `components/site/site-header.tsx:35` (CTA → `/beta?from=nav`); `components/site/site-footer.tsx:20` ("The beta" → `/#beta`, the "Applying for the beta" section); `app/page.tsx:293-317`.
- What's wrong and why it matters: "The beta" in the footer scrolls to an explanatory section; "Apply for the beta" everywhere else goes to the form. Reasonable, but the section itself has no CTA of its own; the CTA is in the following "closing" section. Minor wayfinding nit.
- Suggested fix: Rename the footer link "About the beta".
- Effort: S

### CNT-016 Oxford comma: consistently omitted (no action)
- Severity: Info
- Status: CONFIRMED
- Location: `signup-form.tsx:103` "name, email and program"; `page.tsx:70` "Rate, drive and recovery times, and rhythm" (the second comma is the correct one for a nested "and"); `:245` "Timing, rate and rhythm"; `:299` "High school, college and club"; `model.ts:57` "front, middle and finish".
- What's wrong and why it matters: Nothing; recorded so nobody "fixes" it inconsistently. Same for sentence-case headings (consistent) and the non-Oxford style.
- Effort: none

### CNT-017 Register: US audience, UK rowing vocabulary, US spelling in copy, UK spelling in comments
- Severity: Info
- Status: CONFIRMED
- Location: copy: "high school", "practice", "program", "calibrated" (US); "cox", "outing", "bow side/stroke side" (UK rowing usage); comments: "colours", "centred", "sceptical" (`PRODUCT.md:13`).
- What's wrong and why it matters: Rowing vocabulary is genuinely transatlantic, so "cox"/"outing" are fine for US coaches; the only user-visible tension is CNT-002/CNT-003(10). No user-facing British spellings were found (`grep -r -n -E 'colour|centre|programme|analyse' app components` hits only identifiers/comments). Nothing to change unless the audience is strictly US, in which case "practice" over "outing" and "coxswain" over "cox" on first mention.
- Effort: none

### CNT-018 `lib/stroke.ts` EXAMPLE constants disagree with the numbers the page computes (maintenance hazard, not user-facing)
- Severity: Info
- Status: CONFIRMED
- Location: `lib/stroke.ts:5-17` (`riseKgPerS: 182.6`, `peakPct: 38`, `cvPct: 3.2`) vs live rendered "245 kg/s", "at 36%", "CV 1.8%" (computed by `measureStroke()` in `curve-explorer-model.ts`).
- What's wrong and why it matters: The page's numbers are internally consistent (all computed), which is the design intent ("computed, not typed in", `README.md:32`). The stale constants are not user-facing but a future edit that reads `EXAMPLE.riseKgPerS` would print a number that disagrees with the chart.
- Suggested fix: Delete or derive the unused constants.
- Effort: S

### CNT-019 Product brief (`PRODUCT.md`) has drifted from the site
- Severity: Info
- Status: CONFIRMED
- Location: `PRODUCT.md:15` (athlete section "lower on the page": none exists); `:19` ("strain-gauge node", "SD card": site says "load cell", "microSD"); `:27` (CTA copy "Interested? Contact us for beta testing.": not on site); `:29` ("survives the dock power-off": claim not on the site, so no exposure, but the brief lists it as proof); `:30` (nothing promised vs LEG-009); `:43` (watts: correctly absent from the site).
- What's wrong and why it matters: The brief is the document an agent or a new contributor will trust; three of its factual statements about the site are wrong today.
- Suggested fix: Refresh `PRODUCT.md` after the copy fixes above.
- Effort: S

### CNT-020 Metadata copy check (per page)
- Severity: Info
- Status: CONFIRMED
- Location: `app/layout.tsx:23-49`, `app/beta/page.tsx:6-10`, `app/force/page.tsx:11-16`, `app/vieve/page.tsx:12-17`, `app/app/login/page.tsx:8`, dashboard pages.
- What's wrong and why it matters: Titles are short, unique and sentence-case ("Apply for the beta", "Force, the seat node", "Vieve, the RowTech cox box", "Sign in", "Dashboard", "Sessions"/"Session"/"Cox"/"Crew outing"/"Compare pieces"). Descriptions exist for `/`, `/beta`, `/force`, `/vieve`; the two product descriptions end with the identical tail "Specifications and parts." (fine). The OG image alt (`layout.tsx:40`) repeats the OG title verbatim rather than describing the image (a Force node on a dark background); `twitter.card` set; `locale: en_US`; `applicationName: "RowTech"`. `/force` canonical `/force`, `/vieve` canonical `/vieve`, root canonical `/`; the `/beta` page has no `alternates.canonical`, so it inherits `/` from the root metadata, which would declare `/beta` canonical to `/` (worth confirming with the SEO agent). Straight apostrophes in all descriptions (CNT-005).
- Suggested fix: Give `/beta` its own canonical; make the OG alt descriptive.
- Effort: S

### CNT-021 Vieve page: pricing sentence in the hero lead
- Severity: Info
- Status: CONFIRMED
- Location: `app/vieve/page.tsx:29-30`.
- What's wrong and why it matters: "Vieve will carry the cox's voice ... and be the hub every seat node reports to. The target price is $499." puts a price in the second sentence of a page whose status label is "In development" and whose case is "a concept design". Copy-wise it reads like a pre-order pitch; the spec table already carries it. See LEG-009 for the legal angle.
- Suggested fix: Keep the price in the spec table only, or phrase "We're aiming for $499."
- Effort: S

### CNT-022 Copyright line and footer
- Severity: Info
- Status: CONFIRMED
- Location: `components/site/site-footer.tsx:24`.
- What's wrong and why it matters: `© {new Date().getFullYear()} RowTech`: the year is computed (never stale); "RowTech" is not a legal entity name (LEG-007). Rendered on prerendered pages at build time (`X-Nextjs-Prerender: 1`), so it will show the build year until a redeploy after New Year, which is acceptable.
- Effort: none

---

#### Couldn't check

- Whether a Force node has ever recorded a real on-water session (bears on "What the rower sees on the water", LEG-010 #9). Owner: confirm; if not, reword.
- The LoadCellNode firmware (referenced from comments as `LoadCellNode_v10/storage.cpp`, `render_tft.py`) lives in another repo, so "80 samples a second", the catch-detection threshold, "reports its own worst-case error" and the four-file format could not be verified against source.
- Google Cloud Console: whether the OAuth consent screen is in Testing or Production, whether it is verified, what privacy-policy URL (if any) is configured, and whether the Google provider is enabled in Supabase (README says not yet). Owner: open console, APIs & Services, OAuth consent screen.
- Vercel: whether Web Analytics/Speed Insights data retention and the runtime-log retention are at defaults; whether `NEXT_PUBLIC_POSTHOG_KEY` is set on any non-production environment (it is not in the production bundle). Owner: Vercel, Project, Settings, Environment Variables.
- Supabase: project region (EU/US), whether the Supabase DPA has been accepted, auth email sender/reply-to configuration, and the SMTP rate limit that will hit the login form. Owner: Supabase dashboard, Settings.
- Who produced the "Vieve V1 + Force, concept A" concept sheets and under what terms (LEG-015).
- Trademark clearance for "RowTech", "Vieve", "Force" (a USPTO TESS / EUIPO eSearch knock-out search; not attempted here).
- Whether any beta crew has already been onboarded (bears on LEG-004 urgency) and whether any real athlete data is already in the `sessions`/`strokes` tables (no database reads were performed, per ground rules).
- The Google sign-in and magic-link flows were not exercised (they send real email / create accounts); the button/consent-screen appearance was assessed from source only. Safe owner test: use a throwaway address on a preview deployment, then delete the resulting `auth.users` row.
- The beta form was not submitted; error strings were judged from source, not from rendered screens.
- Live rendering of the 3D diagram notes and the dashboard pages (behind login) was not screenshotted; dashboard copy was read from source.


## 3.4 User experience (UX), 3.5 Layout and formatting (FMT), 3.6 Accessibility (A11Y)

### UX-001 In-page anchors land in the wrong place because of `content-visibility: auto` placeholders
- Severity: High
- Status: CONFIRMED
- Location: `app/globals.css:232-238` (`@utility below-fold { content-visibility: auto; contain-intrinsic-size: auto 900px; }`), used on every section of `app/page.tsx` (`className="below-fold ..."`, lines 131-315); links in `components/site/site-header.tsx:7-12`, `components/site/mobile-menu.tsx`, `components/site/site-footer.tsx:15-22`
- What's wrong and why it matters: Every below-the-fold section on `/` is a 900px placeholder until it is rendered, but the real sections are very different sizes (measured at 375px: placeholder 1093px each; rendered `how`=1869, `stroke`=1479, `products`=1204, `beta-scope`=1325, `faq`=591, `beta`=811, `closing`=408). The browser computes the scroll target with the placeholder heights, then the sections above the target render at their real height and the target moves. Result: the FAQ link in the mobile menu leaves the user on "Where the build stands", 1585px above the FAQ; on desktop `/#faq` lands 247px past the FAQ heading (heading above the viewport); clicking "FAQ" in the header from `/force` lands 796px past it. `/#how`, `/#stroke`, `/#beta`, `/force#specs`, `/vieve#specs` happened to land correctly in the desktop run (target top = 80px = `scroll-padding-top`), but the same mechanism makes any of them fragile depending on which sections have already rendered. This is the site's primary navigation for a first-time visitor.
- Evidence:
  - `flow-log2.txt` `menu-link-faq`: `{"url":"https://www.rowtech.app/#faq","scrollY":6649,"faqTop":1585}` and screenshot `flow-07-after-menu-faq.png` (shows "Where the build stands." instead of the FAQ).
  - `flow-log2.txt` `anchors`: `{"id":"faq","exists":true,"scrollY":6356,"targetTop":-247,...}` (desktop direct load of `/#faq`).
  - `flow-log3.txt` `anchor-click-from-other-page`: `{"url":".../#faq","scrollY":6905,"faqTop":-796}`.
  - `measure.mjs` output: placeholder vs rendered heights quoted above; document height 10112 -> 10339 after render.
  - Secondary symptom: full-page screenshots and desktop tiles `vp-home-d-09..11.png` are identical because the document shrinks after render.
- Suggested fix: drop `content-visibility: auto` from sections that are anchor targets (or from all of them; the page is 200 kB of SSR HTML and paints fine), or give each section its own `contain-intrinsic-size` close to its real height and add a `hashchange`/load handler that re-scrolls to the target after `requestIdleCallback`. Keep `scroll-margin-top` on the targets.
- Effort: S

### UX-002 Beta form gives no feedback on invalid input until the server round-trip
- Severity: High
- Status: CONFIRMED
- Location: `app/beta/signup-form.tsx:113-116` (`<form ... noValidate ...>`), 142-149 (email input has no `onBlur`/`onChange` validation; `aria-invalid` only from server state)
- What's wrong and why it matters: The form disables native validation (`noValidate`) and has no client-side validation of its own, so typing `not-an-email` and leaving the field shows nothing: no message, no red border, `aria-invalid` stays unset. The only feedback arrives after a submit + server action round trip (`submitApplication`), during which the button is disabled and reads "Sending…". Coaches on a phone at the boathouse will submit, wait, then discover the error. The regex `EMAIL` already exists in `app/beta/fields.ts:36` and is used by `checkRequired` for the progressive-disclosure logic, so the form already knows the email is invalid and just does not say so.
- Evidence: `flow-log.txt` `beta-invalid-email-feedback`: `{"value":"not-an-email","validity":false,"ariaInvalid":null,"describedby":null,"errorEl":false,"anyErrorText":[],"borderColor":"rgba(230, 235, 237, 0.22)","alerts":0}`; screenshot `flow-04-beta-375-invalid-email.png` (invalid email, no indication). Also `beta-initial`: `"noValidate":true`.
- Suggested fix: validate the three required fields on blur (reuse `EMAIL` and `REQUIRED`) and render the same `Err` component with `aria-invalid`/`aria-describedby`, or simply remove `noValidate` so the browser's native messages appear on submit.
- Effort: S

### UX-003 404 page is Next's unstyled default: white page, no header, no footer, no way back
- Severity: High
- Status: CONFIRMED
- Location: no `app/not-found.tsx` in the repo (`ls app/not-found.tsx` -> not found); live `https://www.rowtech.app/does-not-exist` and `/team`
- What's wrong and why it matters: A dark, branded site drops the visitor onto a white page with "404 / This page could not be found." in system-ui, no logo, no navigation, no link home, and the generic site `<title>` ("RowTech: the force curve from every seat in the boat") rather than "Page not found". Anyone following an old `/team` link (e.g. from a shared message) gets this. The white background is a flash for a dark site because Next's default 404 only goes dark via `prefers-color-scheme: dark`, while the site forces dark with `class="dark"` on `<html>` (`app/layout.tsx:59`).
- Evidence: screenshots `does-not-exist-mobile.png`, `does-not-exist-desktop.png`, `team-mobile.png`, `404-desktop-light-scheme.png`; `ux-results.json` `desktop /does-not-exist`: `bodyText: "404\nThis page could not be found."`, `hasHeader=false`, `hasFooter=false`, `main=undefined`, `links: []`; `flow-log3.txt` `404-light`: `bodyBg "rgb(255, 255, 255)"`, inline `<style>body{color:#000;background:#fff}...`; `curl -sI /does-not-exist` -> `404`, `Content-Length: 12927`. axe: `landmark-one-main` + `region` (2 nodes) on both 404 URLs.
- Suggested fix: add `app/not-found.tsx` wrapped in `SitePage` with a short message, a link to `/`, `/force`, `/vieve` and `/beta`, and `metadata.title = "Page not found"`.
- Effort: S

### UX-004 Mobile menu does not behave like a menu: no Escape, no outside-click close, no scroll lock, no focus containment
- Severity: Medium
- Status: CONFIRMED
- Location: `components/site/mobile-menu.tsx` (native `<details>` with an absolutely positioned `<nav>`; the only close path is `onClick={close}` on a link)
- What's wrong and why it matters: Opening "Menu" then pressing Escape leaves it open; tapping the page outside the panel leaves it open; the page still scrolls behind it (and the panel scrolls away with the sticky header, staying open); Tab walks out of the five links into the header CTA and the page content while the panel stays open. A user who opens the menu and changes their mind has to find the "Menu" button again. It is also not announced as expandable: Playwright's ARIA snapshot exposes it as `group: Menu` with no button role or expanded state.
- Evidence: `flow-log.txt`: `menu-escape-closes: false`, `menu-click-outside-closes: false`, `menu-scroll-lock: {"scrollY":300,"stillOpen":true}`, `menu-open.bodyOverflow "visible"`, `menu-tab-order` (after the 5 links focus continues to "Apply for the beta" (header), "Apply for the beta" (hero), "See Force", the crew region) and `menu-still-open-after-tabbing-out: true`; `menu-summary-attrs`: `ariaExpanded null, ariaLabel null, ariaControls null, role null`; `measure.mjs` header ARIA snapshot (`group: Menu`). Screenshot `flow-06-mobile-menu-open.png`.
- Suggested fix: keep `<details>` if you like but add `onKeyDown` Escape -> `close()`, a document `pointerdown` listener that closes when the target is outside, `aria-expanded` mirrored from `open` on the summary, and either lock body scroll or close on scroll. Alternatively use the already-installed `@base-ui/react` Popover/Dialog which does all of this.
- Effort: S

### UX-005 The beta form cannot be submitted without JavaScript, contrary to the code comment
- Severity: Medium
- Status: CONFIRMED
- Location: `app/beta/signup-form.tsx:64-70` (comment "Without JS the form still posts, minus that part") and `:113-116`; the `useActionState` wrapper is a client closure, not a server reference
- What's wrong and why it matters: Because the action passed to the form is an inline client function (it wraps `submitApplication` to add attribution and analytics), React renders `action="javascript:throw new Error('React form unexpectedly submitted.')"` in the server HTML. With JS off, or before hydration on a slow connection, pressing the button throws and nothing is sent. The comment claims progressive enhancement that does not exist.
- Evidence: `curl -s https://www.rowtech.app/beta | grep -o '<form[^>]*>'` -> `<form noValidate="" class="mt-10 space-y-7" action="javascript:throw new Error(&#x27;React form unexpectedly submitted.&#x27;)">`; `flow-log3.txt` `nojs /beta`: `"formAction": "javascript:throw new Error('React form u", "formMethod": "get"`. No `$ACTION_ID` hidden inputs in the HTML.
- Suggested fix: pass the server action directly (`action={submitApplication}` via `useActionState(submitApplication, ...)`) and move attribution into hidden inputs written by `AttributionCapture`, or accept the JS requirement and delete the comment.
- Effort: S

### UX-006 After a failed submit the whole form remounts, so focus and scroll position are lost
- Severity: Medium
- Status: NEEDS MANUAL CHECK (from code; not exercised because it requires submitting)
- Location: `app/beta/signup-form.tsx:110` (`key={state === EMPTY_STATE ? "init" : JSON.stringify(v) + state.message}`)
- What's wrong and why it matters: The `key` changes on every non-initial state, which unmounts and remounts the entire `<form>`. The element that had focus (the submit button) is destroyed, focus falls to `<body>`, and the user is not moved to the first error. The `role="alert"` paragraph at the top will be announced by screen readers, but sighted keyboard users and anyone scrolled to the bottom of the form get no cue. Field-level errors are wired correctly (`aria-invalid`, `aria-describedby="<field>-error"`, `Err` renders `<p id="<field>-error">`), which makes this the remaining gap.
- Evidence: code lines cited; error-wiring verified in the DOM (`ux-results.json` inputs on /beta).
- Suggested fix: remove the `key` trick (use `defaultValue` from state without remounting, or controlled inputs) and after an error state focus the first `[aria-invalid=true]` input or the alert. Owner can test safely with `BETA_DRY_RUN=1` on a local build (tests/*.spec.ts already do this).
- Effort: S
### UX-007 3D device stage is an empty grey box with a misleading "Drag the model" hint when the scene is not loaded
- Severity: Medium
- Status: CONFIRMED
- Location: `components/site/device-diagram-3d.tsx:182-219` (poster shown until `near`, hint paragraph always rendered), `app/force/page.tsx:71-75` and `app/vieve/page.tsx:60-64` (`poster={<DevicePlaceholder ratio=... name="FORCE" />}`)
- What's wrong and why it matters: With JS disabled, without WebGL, or in the moment before the three.js chunk arrives, the stage is a flat dark rounded rectangle with the word "FORCE"/"VIEVE" in it, and under it the copy says "Drag the model, or use the arrow keys, to turn it." There is nothing to drag. The page also has two-dimensional device drawings already (`ForceDevice`/`VieveDevice` SVGs used on `/`), which would make a far better poster. The numbered notes still read fine, so the content survives; the stage just looks broken.
- Evidence: screenshot `nojs-force-desktop.png` (grey box labelled FORCE, hint below), `nojs-vieve-desktop.png`; `flow-log3.txt` `nojs /force`: `stage {"w":598,"h":449,"hasSvg":false,"hint":"Drag the model, or use the arrow keys, to turn it."}`, `canvases: 0`.
- Suggested fix: use the SVG device drawing as the poster and render the drag hint only once the scene has mounted (or wrap it in the same `near` condition).
- Effort: S

### UX-008 Upload form (dashboard): no progress, no cancel for a 25 MB multi-file upload; error text relies on `whitespace-pre-line`
- Severity: Medium
- Status: CONFIRMED (code; the dashboard is gated so it was not exercised live)
- Location: `app/app/(dash)/force/upload-form.tsx:38-47, 90-103`; `next.config.ts` serverActions bodySizeLimit 25mb
- What's wrong and why it matters: The submit button becomes `disabled={pending}` with a spinner and "Reading the session…", which prevents double submission (good), but for a 25 MB zip over boathouse WiFi there is no progress bar, no byte count, no cancel and no timeout message; the user just waits. Errors are one `<p role="alert">` using `whitespace-pre-line` for multi-file messages, so long server strings (`${where}${e.message}`) wrap as an unformatted block; there is no per-file breakdown. Success navigates away via `router.push` in an effect, so the "ok" state is never shown. `recorded_at` is filled in `useEffect` with the browser's local time, which is correct for a clock-less node but is silently pre-filled: a coach uploading Monday's outing on Tuesday gets Tuesday's date unless they notice. The sessions list does have an empty state ("Nothing here yet. Upload a session from a node and it lands here.", `page.tsx:50-53`) and the history panel is only rendered with more than one session (`page.tsx:89`), so those two gaps are covered.
- Evidence: code lines cited; `actions.ts:45-79` error strings.
- Suggested fix: show file names + sizes with a simple indeterminate progress bar and an explicit "this can take a minute for large sessions" line; render errors as a list; label the date field "Defaults to now; change it if the outing was earlier."
- Effort: M

### UX-009 `deleteSession` exists but nothing calls it (no delete UI, so no confirmation question yet)
- Severity: Low
- Status: CONFIRMED
- Location: `app/app/(dash)/force/actions.ts:210` (`export async function deleteSession(id: string)`); `grep -rn deleteSession app components lib` returns only the definition; `components/dash/session-viewer.tsx` has no `confirm()` and no delete control
- What's wrong and why it matters: A beta crew cannot remove a mistaken upload from the dashboard. When the button is added, it needs a confirmation (the action deletes the session, its files and strokes) and a pending state.
- Evidence: grep output above; `session-viewer.tsx` onClick handlers at lines 122, 183, 190, 202 are seat/metric/compare/download only.
- Suggested fix: either wire a "Delete session" button with `confirm()` (or a Base UI AlertDialog) and `useTransition`, or remove the dead action until then.
- Effort: S

### UX-010 Dashboard timestamps are formatted on the server with `toLocaleString()`
- Severity: Low
- Status: SUSPECTED
- Location: `app/app/(dash)/force/page.tsx:68` (`new Date(s.recorded_at).toLocaleString()` inside a server component)
- What's wrong and why it matters: The list of sessions is rendered on Vercel (UTC, en-US) so a UK or Australian coach sees US-formatted UTC times, which will not match the local time they typed into the upload form.
- Evidence: code; not verifiable live without a beta account.
- Suggested fix: format with an explicit `timeZone`/locale from the viewer's profile, or render the time in a small client component.
- Effort: S

### UX-011 Header link labels do not match the section headings they jump to
- Severity: Low
- Status: CONFIRMED
- Location: `components/site/site-header.tsx:7-12`, `components/site/site-footer.tsx:15-22`, `app/page.tsx` section headings
- What's wrong and why it matters: "How it works" -> "How an outing gets from the rigger to your phone."; "One stroke" -> "One stroke, taken apart."; footer "The beta" -> "Applying for the beta."; "FAQ" -> "Questions a coach might ask." Combined with UX-001 (landing in the wrong place) the visitor has no textual confirmation that the jump succeeded.
- Evidence: `ux-results.json` `desktop /` headings list; header/footer source.
- Suggested fix: either reuse the link label as an eyebrow above each section heading (e.g. small "How it works" label) or rename the links.
- Effort: S

### UX-012 Every "Apply for the beta" variant is a separate dynamic page and is prefetched separately
- Severity: Low
- Status: CONFIRMED
- Location: `components/site/cta.tsx:23` (`href={`/beta?from=${from}`}`); `app/beta/page.tsx` reads `searchParams` (dynamic)
- What's wrong and why it matters: On the landing page four different `/beta?from=...` URLs (nav, hero, stroke, closing) are prefetched as separate RSC payloads: 130 kB of `fetch` traffic on the home page before the visitor touches anything, and none of it is cacheable at the CDN because the page is dynamic. Some prefetches are aborted mid-flight (`net::ERR_ABORTED` in every run), which is harmless but noisy.
- Evidence: `flow-log3.txt` `perf-mobile-home.responsesByType.fetch = 130257`; `ux-results.json` failedRequests e.g. `https://www.rowtech.app/beta?from=nav&_rsc=p37cr :: net::ERR_ABORTED` on `mobile /`, `tablet /`, `desktop /vieve`, `tablet /app/login`.
- Suggested fix: make `/beta` static and read `from` on the client (it is already captured by `AttributionCapture`/`track`), or set `prefetch={false}` on the CTA links.
- Effort: S

### UX-013 `/favicon.ico` is a 404
- Severity: Low
- Status: CONFIRMED
- Location: `app/icon.svg` exists; no `app/favicon.ico` or `public/favicon.ico`
- What's wrong and why it matters: Modern browsers use the `<link rel="icon">` from `app/icon.svg`, but Safari pinned tabs, some RSS/bookmark tools, Slack/Teams unfurls and older browsers request `/favicon.ico` directly and get a 404 (also logged as a console error on those clients).
- Evidence: `flow-log3.txt` `link-crawl`: `404 https://www.rowtech.app/favicon.ico`; `200 /icon.svg`, `200 /og.png`.
- Suggested fix: add `app/favicon.ico` (Next serves it at `/favicon.ico`) and an `apple-icon.png`.
- Effort: S

### UX-014 Title separator differs between the marketing site and the app
- Severity: Info
- Status: CONFIRMED
- Location: `app/layout.tsx:27` (`template: "%s | RowTech"`) vs `app/app/layout.tsx:6` (`template: "%s · RowTech"`)
- What's wrong and why it matters: Tabs read "Apply for the beta | RowTech" next to "Sign in · RowTech". Cosmetic inconsistency.
- Evidence: `ux-results.json` titles: `"Apply for the beta | RowTech"`, `"Sign in · RowTech"`.
- Suggested fix: pick one separator.
- Effort: S

### UX-015 `/team` mismatch with the audit brief: it is a 404 now, linked from nowhere
- Severity: Info
- Status: CONFIRMED
- Location: git `aba1b1a site: remove the team page for now`; `tests/marketing.spec.ts:58-61` ("there is no team page for now")
- What's wrong and why it matters: the audit brief says the live site served `/team` with 200 while the repo had no page; at audit time the deploy has caught up and `/team` returns the default 404 (see UX-003). No live page links to `/team` (link crawl of `/`, `/beta`, `/force`, `/vieve`, `/app/login` found none) and `grep -rn "/team" app components lib README.md` finds nothing. Only the Playwright test references it. Any external link to `/team` (social bios, emails) now dead-ends on the unbranded 404.
- Evidence: `flow-log3.txt` `link-crawl`: `404 https://www.rowtech.app/team`; `ux-results.json` `* /team` status 404.
- Suggested fix: none needed beyond UX-003; optionally add a `redirects()` entry `/team -> /` if the URL was ever shared.
- Effort: S

### UX-016 Performance-adjacent numbers for `/` at 375px (unthrottled connection, from Playwright)
- Severity: Info
- Status: CONFIRMED
- Location: live `/`
- What's wrong and why it matters: The page is fast on a good connection: TTFB 81 ms, FCP 472 ms, LCP 472 ms (the `<h1>` text, 52,765 px area), DOMContentLoaded 243 ms, load 589 ms, CLS 0. Weight is the concern: the HTML is 198,218 bytes decoded (28,569 bytes over the wire with brotli; the rest is inline SVG device drawings and the duplicated RSC payload Next embeds in `self.__next_f` script tags). JavaScript: 14 script files, 600,663 bytes decoded / about 187 kB on the wire, including two chunks of 203 kB and 137 kB decoded on a page that has no 3D. Fonts: 2 woff2, 116,476 bytes (Archivo with the `wdth` axis is 90 kB on its own). Total: 29 responses, 348 kB transferred resources + 29 kB HTML; 1.1 MB decoded across all responses. Lighthouse was not run (not installed; see Couldn't check).
- Evidence: `flow-log3.txt` `perf-mobile-home` (full breakdown, per-chunk sizes); `curl -H "Accept-Encoding: identity" ... size=198218`; `curl -H "Accept-Encoding: br" ... size=28569`.
- Suggested fix: subset Archivo (or drop the `wdth` axis on body copy and load a condensed static instance for headings), check what the 203 kB chunk contains (`next build` with `ANALYZE`), and consider moving the stroke explorer island's data (14 buttons and a large SVG are SSR'd twice) out of the critical HTML.
- Effort: M

---

#### FMT findings (layout / formatting)

### FMT-001 Mobile menu panel overflows the left edge of a 375px screen by 13px
- Severity: Medium
- Status: CONFIRMED
- Location: `components/site/mobile-menu.tsx:16-19` (`<nav className="absolute right-0 top-12 z-50 w-56 ...">` inside `<details className="relative lg:hidden">`)
- What's wrong and why it matters: The `<details>` element sits at x=155..211 in the header (between the logo and the CTA). The panel is `w-56` (224px) and right-aligned to the details element, so its left edge is at x=-13: the left border and rounded corners are clipped and the first 13px of the panel are off-screen. The links' padding hides most of it but the panel visibly starts flush against the screen edge without its border.
- Evidence: `flow-log2.txt` `menu-clip@375`: `{"left":-13,"right":211,"width":224,"innerWidth":375}`; screenshot `flow-06b-mobile-menu-open-clip.png` (panel's left border missing, corner cut) and `flow-06-mobile-menu-open.png`.
- Suggested fix: position the panel relative to the header container (`inset-x-4 top-16` on a `relative` header) or use `right-0 max-w-[calc(100vw-2rem)] w-56` with the details element moved next to the screen edge.
- Effort: S

### FMT-002 Stroke explorer at 375px: marker 7 overlaps the "catch threshold" label
- Severity: Medium
- Status: CONFIRMED
- Location: `components/site/curve-explorer-view.tsx:85-96` (mobile markers `size-7` positioned on the curve) and the threshold label text in the same SVG
- What's wrong and why it matters: On the home page's "One stroke, taken apart" chart at 375px the circular "7" marker (Rhythm, 28x28 at page x=302,y=4735) sits on top of the dashed-line label "catch threshold" (61x10 at x=286,y=4757), so the label reads "catc… …shold". The label explains the yellow dashed line that the Catch explanation refers to ("crosses 15% of the rower's recent peak").
- Evidence: `measure.mjs` output: `overlaps: [{"text":"catch threshold","marker":"Rhythm: 1 : 1.70","textRect":{"x":286,"y":4757,"w":61,"h":10},"markerRect":{"x":302,"y":4735,"w":28,"h":28}}]`; screenshots `fmt-explorer-375-overlap.png`, `vp-home-m-06.png` (top-right of the chart).
- Suggested fix: on narrow screens move the threshold label to the left end of the dashed line (it is empty there) or give the label the `.rt-halo` treatment and raise its z-order above the markers.
- Effort: S

### FMT-003 Stroke explorer chip grid at 375px leaves "7 Rhythm" orphaned in a row of its own
- Severity: Low
- Status: CONFIRMED
- Location: `components/site/curve-explorer-view.tsx:252-262` (`<ol aria-label="Stroke metrics" className="mt-4 grid grid-cols-2 gap-2 sm:hidden">` with 7 items)
- What's wrong and why it matters: Seven metrics in a two-column grid produce three full rows and a lone half-width chip ("7 Rhythm") at x=20,y=5077 (164x44). It reads as if something is missing from the right column.
- Evidence: `measure.mjs` `chips` rects (7 entries; last one alone); screenshot `vp-home-m-06.png`.
- Suggested fix: make the last chip span both columns (`last:col-span-2`) or use a single-column list at <400px.
- Effort: S

### FMT-004 The 404 page is a white, system-font page on a dark, Archivo-set site
- Severity: Low
- Status: CONFIRMED
- Location: default Next not-found (no `app/not-found.tsx`)
- What's wrong and why it matters: Same root cause as UX-003; listed here because it is also the only place the site's palette breaks: white background `rgb(255,255,255)`, black `24px` system-ui "404" with a vertical hairline, nothing else. On the forced-dark `<html class="dark">` the `color-scheme: dark` from `globals.css` applies to form controls but Next's inline style overrides the body colours.
- Evidence: `flow-log3.txt` `404-light` (inline style quoted), screenshots `does-not-exist-desktop.png`, `does-not-exist-mobile.png`.
- Suggested fix: covered by UX-003.
- Effort: S

### FMT-005 The hero force curve is cut off at the left edge at 375px
- Severity: Low
- Status: SUSPECTED (may be intentional "edge to edge")
- Location: `components/site/hero.tsx:43-46` (`<ScopeStrip />` "runs the full width of the screen, edge to edge"), `components/site/scope-strip.tsx`
- What's wrong and why it matters: At 375px the curve's rising edge starts off-canvas: the trace enters the viewport at x=0 already part-way up the drive, so the "catch" (the point the whole page is about) is not visible on phones. On desktop the full rise is visible (`vp-home-d-01.png`). The axis labels (60 kg / 40 / 20 / 0) are right-aligned and fine.
- Evidence: screenshots `vp-home-m-01.png` (curve enters mid-rise at x=0) vs `vp-home-d-01.png`.
- Suggested fix: at `max-sm` scale the strip's viewBox so the catch sits at x>=16px, or use `preserveAspectRatio="xMinYMid slice"` anchored on the catch.
- Effort: S

### FMT-006 Full-page screenshots and print/visual-regression tools see blank sections below the fold
- Severity: Info
- Status: CONFIRMED
- Location: `app/globals.css:232-238`
- What's wrong and why it matters: Because sections are `content-visibility: auto`, a full-page capture from scroll position 0 (Playwright `fullPage`, browser "capture full size screenshot", many visual-diff services) renders every off-screen section as an empty placeholder. The first set of full-page screenshots in `shots/home-*.png` are blank below the crew section for this reason and had to be retaken as viewport tiles. Anyone comparing screenshots in review will hit this.
- Evidence: `tile-home-m-02..06.png` (blank), replaced by `vp-home-m-*.png`; `home-mobile.png`/`home-desktop.png`/`home-tablet.png` are affected the same way.
- Suggested fix: same as UX-001.
- Effort: S

### FMT-007 No horizontal overflow, no clipped text, consistent gutters (positive)
- Severity: Info
- Status: CONFIRMED
- Location: all 7 pages x 3 viewports
- What's wrong and why it matters: Nothing: `scrollWidth === innerWidth` on all 21 page/viewport combinations; chips, spec tables, footers and headings wrap cleanly at 375px (`beta-chips@375`: all 12 chips 44px tall, no overflow); the 16px/20px side gutter is consistent; the form at 375px is well proportioned (`flow-02-beta-375-viewport.png`, `flow-03-beta-375-details-open.png`).
- Evidence: `ux-results.json` `overflow:false` for every key; screenshots listed.
- Suggested fix: none.
- Effort: -

---
#### A11Y findings

### A11Y-001 No skip link; keyboard users tab through 7 header controls before reaching content on every page
- Severity: High
- Status: CONFIRMED
- Location: `components/site/site-page.tsx`, `app/beta/page.tsx`, `app/page.tsx` (each has `<main id="main">` but no link to it); `grep -rn -i skip app components` finds only the CSS comment at `app/globals.css:232`
- What's wrong and why it matters: The first Tab stop is the logo, then five nav links, then the CTA: 7 stops on `/`, `/force`, `/vieve` and 6 on `/beta` before any page content, on every page load and every in-site navigation. WCAG 2.4.1 Bypass Blocks. The `id="main"` target already exists.
- Evidence: `flow-log3.txt` `tab-order /` stops 1-7 (`RowTech home`, `How it works`, `One stroke`, `Force`, `Vieve`, `FAQ`, `Apply for the beta`), `skip-link /`: `{"firstHashLink":null,"anySkip":false}` (same on `/beta` and `/app/login`).
- Suggested fix: add `<a href="#main" className="sr-only focus:not-sr-only ...">Skip to content</a>` as the first child of `SiteHeader` and give `<main>` `tabIndex={-1}`.
- Effort: S

### A11Y-002 Login page: "Apply for the beta" link inside a sentence is distinguishable only by colour
- Severity: High (axe impact: serious)
- Status: CONFIRMED
- Location: `app/app/login/page.tsx:26-28` (`<Link ... className="text-trace underline-offset-4 hover:underline">Apply for the beta</Link>` inside a `<p className="text-muted-foreground">`)
- What's wrong and why it matters: The link is cyan `#22e3ef` on grey `#8d9aa6` body text (1.82:1 between link and surrounding text; 3:1 required when there is no non-colour cue) and the underline only appears on hover. Colour-blind users and anyone on a dim boathouse screen cannot tell it is a link. WCAG 1.4.1.
- Evidence: axe `link-in-text-block` (serious) on `/app/login` at both mobile and desktop: "The link has insufficient color contrast of 1.82:1 with the surrounding text ... The link has no styling (such as underline)"; `ux-results.json` `desktop /app/login`.axe. Screenshot `app_login-mobile.png`.
- Suggested fix: add `underline` (not just on hover), as the hero's "See Force" link already does.
- Effort: S

### A11Y-003 404 page has no landmarks and no useful title
- Severity: Medium (axe: moderate x2)
- Status: CONFIRMED
- Location: default Next not-found
- What's wrong and why it matters: axe `landmark-one-main` ("Document does not have a main landmark") and `region` (h1 and h2 outside any landmark). `<title>` stays the home-page title, so screen-reader users hear the marketing tagline for a page that says 404.
- Evidence: `ux-results.json` `* /does-not-exist`.axe and `* /team`.axe; title `"RowTech: the force curve from every seat in the boat"`.
- Suggested fix: covered by UX-003 (`app/not-found.tsx` with `<main>` and `title: "Page not found"`).
- Effort: S

### A11Y-004 Mobile menu trigger lacks an explicit button role / expanded state and does not manage focus
- Severity: Medium
- Status: CONFIRMED (attributes) / SUSPECTED (AT announcement varies by browser + screen reader)
- Location: `components/site/mobile-menu.tsx:11-13`
- What's wrong and why it matters: `<summary>` relies on native semantics, which are inconsistent across assistive technology (VoiceOver on iOS reads it as plain text in some versions; NVDA reads "button, collapsed" in Chrome/Firefox). Playwright's accessibility snapshot exposes it as `group: Menu`, i.e. no button role, no expanded state. There is no `aria-controls`, no Escape handling, and focus is not moved into the panel or returned to the trigger.
- Evidence: `flow-log.txt` `menu-summary-attrs` (all null); `measure.mjs` header ARIA snapshot (closed: `group: Menu`; open: `group:` -> `text: Menu`, `navigation "Primary"`); `menu-escape-closes: false`.
- Suggested fix: add `role="button" aria-expanded={open} aria-controls={navId}` on the summary (sync `open` via `onToggle`), Escape to close and refocus the trigger; or switch to Base UI's Popover.
- Effort: S

### A11Y-005 Touch targets under 44x44 CSS px on mobile
- Severity: Medium
- Status: CONFIRMED
- Location: `components/site/site-header.tsx:19` (logo link), `components/site/hero.tsx:38` ("See Force"), `components/site/site-footer.tsx:15-22` (six footer links), `app/page.tsx` product cards ("See Force/Vieve and its specifications"), `components/site/curve-explorer-view.tsx:85-96` (7 SVG marker buttons), `components/site/mobile-menu.tsx:11` ("Menu")
- What's wrong and why it matters: At 375px the following interactive elements are smaller than 44x44 (WCAG 2.5.8's 24x24 minimum is met by all of them; the 44x44 best practice / Apple HIG is missed):
  - `a "RowTech home"` 28x35 at (16,15) on every page
  - `summary "Menu"` 56x40 at (155,12); `a "Apply for the beta"` (header) 140x40
  - `a "See Force"` 63x15 at (245,881) on `/`
  - 7 x `button` markers on the explorer 28x28 (e.g. "Catch: ≈3 ms" at (68,3907), "Rhythm: 1 : 1.70" at (302,3959))
  - `a "See Force and its specifications"` 232x17, `a "See Vieve and its specifications"` 231x17
  - footer: `How it works` 78x20, `Force` 36x20, `Force specifications` 124x20, `Vieve` 35x20, `Vieve specifications` 123x20, `The beta` 54x20 (28px row pitch, so adjacent rows are 8px apart)
  - `/app/login`: `a "Apply for the beta"` 321x40 (inline text link), logo 28x35
  - The 3D-diagram dots (24x24, `button "1".."7"`) are `aria-hidden tabIndex={-1}` duplicates of the notes and are excluded from this list.
- Evidence: `ux-results.json` `mobile /`.smallTargets (19 entries), `mobile /beta` (9), `mobile /force` (16), `mobile /vieve` (12), `mobile /app/login` (2); the full lists are in the appendix.
- Suggested fix: `py-3` on footer links and `min-h-11` on the logo/summary; enlarge explorer markers to 44px hit areas with a transparent padding (`before:absolute before:-inset-2`).
- Effort: S

### A11Y-006 Stroke explorer on mobile puts every metric in the tab order twice
- Severity: Medium
- Status: CONFIRMED
- Location: `components/site/curve-explorer-view.tsx:85-96` (marker buttons, `size-7 ... sm:size-auto`) and `:252-262` (`<ol aria-label="Stroke metrics" className="... sm:hidden">` chip buttons)
- What's wrong and why it matters: Below `sm` both the seven SVG marker buttons ("Catch: ≈3 ms" etc.) and the seven chip buttons ("1 Catch" etc.) are rendered and focusable, so a keyboard or switch user on a phone tabs through 14 controls for 7 choices, hearing each metric twice. (On desktop the chips are hidden and the markers become the callouts, so it is 7 there.)
- Evidence: `flow-log3.txt` `nojs /` explorer: `buttons: 14`; `ux-results.json` `mobile /`.smallTargets lists the 7 markers; `tab-order /` stops 11-15 are the marker buttons on desktop.
- Suggested fix: on narrow screens make the markers `aria-hidden tabIndex={-1}` (as the 3D diagram already does for its dots) and keep the chips as the accessible control.
- Effort: S

### A11Y-007 3D model stage: focusable `role="group"` with arrow-key behaviour and a `<canvas>` with no accessible name
- Severity: Low
- Status: CONFIRMED
- Location: `components/site/device-diagram-3d.tsx:182-219`; `components/device3d/scene.tsx` (R3F `<Canvas>`)
- What's wrong and why it matters: The stage is `role="group" tabIndex={0} aria-label="3D model: Parts of the Force node" aria-describedby=<hint>` and reacts to arrow keys, but `group` is not an interactive role so screen readers announce it as a group and will not expect keys to do anything; the `<canvas>` itself has no role/label (its fallback text is "FORCE"). The good news: the numbered notes list is a full text alternative (`figure` with `figcaption`, `list "Parts of the Force node"` of 7 labelled buttons with `aria-pressed`), so the content is accessible; the interaction just is not described. The scene honours `prefers-reduced-motion` (`scene.tsx:151`, `still` -> "go straight there"; idle frames do not differ under either setting).
- Evidence: `measure.mjs` `force figure aria` snapshot and `canvas attrs: {role:null, ariaLabel:null, ariaHidden:null, tabIndex:-1, text:'FORCE'}`; `flow-log3.txt` `3d-idle-frames-differ reduce: false`.
- Suggested fix: `role="img"` + `aria-roledescription="3D model"` on the stage with `aria-hidden` on the canvas, or `role="application"` with a clear `aria-describedby` that mentions arrow keys.
- Effort: S

### A11Y-008 Crew-view scroll region is a Tab stop that does nothing on wide screens
- Severity: Low
- Status: CONFIRMED
- Location: `components/site/crew-lanes.tsx:52` (`<div role="region" className="instrument overflow-x-auto" tabIndex={0} aria-label="Crew view illustration, scrolls sideways on narrow screens">`)
- What's wrong and why it matters: Making the scrollable region focusable is correct on phones, but at 1440px the SVG fits and the region is still Tab stop 10 on `/`, announced as "scrolls sideways on narrow screens" on a wide screen.
- Evidence: `flow-log3.txt` `tab-order /` stop 10: `div "Crew view illustration, scrolls sideways on narrow" ... 672x342`.
- Suggested fix: set `tabIndex` only when `scrollWidth > clientWidth` (small client effect) or drop the "narrow screens" wording.
- Effort: S

### A11Y-009 Colour contrast: axe could not evaluate 105-111 text nodes on `/` (SVG readouts), everything it could evaluate passes
- Severity: Low
- Status: NEEDS MANUAL CHECK
- Location: device-screen SVGs (`components/device/force-screen.tsx`, `vieve-screen.tsx`), `components/site/scope-strip.tsx`, crew lanes
- What's wrong and why it matters: axe reported 0 `color-contrast` violations but 111 (mobile) / 105 (desktop) `incomplete` nodes on `/`, 22-51 on `/force`, 43-56 on `/vieve`, all SVG `<text>` (e.g. `svg[y="90"] > text[letter-spacing="2.2"][font-size="14"]`, `text[fill="#3ddc6e"]`) that it cannot resolve against layered backgrounds. A manual sweep of DOM text (script in `flow.mjs` section 7) found no failures: muted copy `rgb(159,179,188)` on `rgb(10,28,35)` is about 8:1; hero copy on the river `rgb(14,43,53)` is about 7.5:1; input placeholder on `#0b0e11` passes. The unresolved SVG readouts are illustrations with full `role="img"` alt text, so they are decorative for AT, but the small mono labels ("kg · avg 10 62.4", "PEAK FORCE") are around 10-11px and should be checked by eye on a real phone.
- Evidence: `ux-results.json` `*.axe.incomplete`; `flow-log3.txt` `contrast-fails /: []` (and `/beta`, `/force`, `/app/login`).
- Suggested fix: none required for conformance; consider raising the readout label colour on the device screens if legibility matters for the marketing shot.
- Effort: S

### A11Y-010 Honeypot may be autofilled by password managers/browsers, silently discarding real applications
- Severity: Low
- Status: SUSPECTED
- Location: `app/beta/signup-form.tsx:209-213` (`<div aria-hidden className="absolute -left-[9999px] ..."><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>`); `app/beta/actions.ts:54` (`if (text(fd, "website")) return { status: "ok", ... }`)
- What's wrong and why it matters: The honeypot is correctly hidden from AT (`aria-hidden`) and keyboard (`tabIndex -1`). But `name="website"` with a visible label "Website" is exactly the field name Chrome/Safari autofill and 1Password fill from a saved address (`autocomplete="off"` is widely ignored for address data). A coach who accepts an address autofill on Name/Organization gets a silent fake success (`status: "ok"`) and never hears back.
- Evidence: code lines cited; `ux-results.json` inputs on /beta: `input[name=website][type=text] label="Website"`.
- Suggested fix: rename to a non-address-like name (e.g. `name="fax_confirm"`), keep it out of autofill with `autocomplete="one-time-code"` or make it a checkbox, and log honeypot hits server-side.
- Effort: S

### A11Y-011 Pending-state text changes are not announced
- Severity: Low
- Status: CONFIRMED (code)
- Location: `app/beta/signup-form.tsx:216-228`, `app/app/login/login-form.tsx:72-86`, `app/app/(dash)/force/upload-form.tsx:90-103`
- What's wrong and why it matters: Each submit button swaps its label to "Sending…"/"Reading the session…" and becomes `disabled`, which stops double submission (asked in the brief: yes, `disabled={pending}` on all three, so a double-click cannot fire twice), but a disabled element loses focus in some browsers and there is no `aria-live`/`aria-busy`, so a screen-reader user hears nothing until the result alert appears.
- Evidence: code lines cited; `flow-log.txt` `beta-initial.submitDisabled: false` (idle state verified; pending state not exercised).
- Suggested fix: add `aria-busy={pending}` on the form and a visually hidden `aria-live="polite"` status ("Sending your application…"); prefer `aria-disabled` over `disabled` to keep focus.
- Effort: S

### A11Y-012 Positive checks (recorded so they are not re-audited)
- Severity: Info
- Status: CONFIRMED
- Location: various
- What's wrong and why it matters: Nothing wrong. Verified:
  - `<html lang="en">`; viewport `width=device-width, initial-scale=1` with no `maximum-scale`/`user-scalable=no` (zoom allowed) on every page.
  - Exactly one `<h1>` per page and no heading-level skips on any page (`headingSkips: []` everywhere; full outlines in the appendix).
  - Every `<img>`/`svg[role=img]` has an accessible name (7 on `/`, 2 on `/force`, 3 on `/vieve`; names are long, descriptive alt text). No `<svg>` without `aria-hidden`/`role` outside buttons. No icon-only buttons/links without a name (`iconButtons: []` on every page; the FAQ +/- and menu icons are `aria-hidden` spans and the `<summary>` has visible text).
  - Focus indicator: global `:focus-visible { outline: 2px solid var(--ring); outline-offset: 3px }` (`globals.css:182-185`); every one of the 15 Tab stops on `/`, 15 on `/beta` and all on `/app/login` had a visible outline or ring (`indicator=true` throughout; inputs use `focus:ring-3` box-shadow instead of outline). Screenshots `tab-home-stop3.png` (outline on "One stroke"), `flow-05a-beta-375-chip-focus.png` (cyan ring on the "Coach" chip via `has-[:focus-visible]`), `flow-08-faq-summary-focus.png`.
  - FAQ `<details>`: Enter opens, Space toggles, summary is focusable with a visible ring (`faq-keyboard: {afterEnter:true, afterSpace:false}`).
  - Beta form labels: all 18 inputs have programmatic labels (`<label htmlFor>` for text fields; chips wrap the `sr-only` radio/checkbox inside the `<label>`, so the ARIA snapshot reads `radio "Coach"`, `checkbox "8+"`); `fieldset`/`legend` for the two groups; error wiring `aria-invalid` + `aria-describedby="<field>-error"` + `<p id="<field>-error">` in code; honeypot `aria-hidden` + `tabIndex -1`.
  - Progressive disclosure works: filling name/email/org opens "Tell us about your boat" automatically (`beta-after-required.detailsOpen: true`, screenshot `flow-03-beta-375-details-open.png`).
  - `prefers-reduced-motion: reduce`: hero screen animation stops (`hero-stroke` counter and cursor frozen, `document.getAnimations().length` 0 vs 2, `scroll-behavior: auto`), 3D scene snaps instead of easing, spinners use `motion-reduce:animate-none`.
  - Forced dark theme is unaffected by `prefers-color-scheme: light` (`home-desktop-light-scheme.png`, `beta-desktop-light-scheme.png`; body bg stays `rgb(10,28,35)`, inputs `rgb(11,14,17)`).
  - Landmarks: `header`, `nav "Primary"`, `main#main`, `footer`, `nav "Footer"` on all marketing pages; login has `main` only (acceptable for a focused page).
- Evidence: `ux-results.json`, `flow-log*.txt`, screenshots named.
- Suggested fix: none.
- Effort: -

---
#### Appendix A: per-page console and network errors

Legend: `console` = console.error/warning + pageerror; `failedReq` = `requestfailed`; `badResp` = responses with status >= 400. Empty means none.

| Viewport | Page | Status | console | failedReq | badResp |
|---|---|---|---|---|---|
| mobile | / | 200 | - | `/beta?from=nav&_rsc=p37cr :: net::ERR_ABORTED` (aborted prefetch) | - |
| mobile | /beta | 200 | - | - | - |
| mobile | /force | 200 | `[warning] THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.`; 4x `[warning] GL Driver Message ... GPU stall due to ReadPixels` (headless GL only) | - | - |
| mobile | /vieve | 200 | `[warning] THREE.Clock ... deprecated` | `/beta?_rsc=185p2 :: net::ERR_ABORTED` | - |
| mobile | /team | 404 | `[error] Failed to load resource: the server responded with a status of 404 ()` | - | `404 /team` |
| mobile | /app/login | 200 | - | - | - |
| mobile | /does-not-exist | 404 | `[error] Failed to load resource: ... 404` | - | `404 /does-not-exist` |
| tablet | / | 200 | - | `/beta?from=nav&_rsc=p37cr :: net::ERR_ABORTED` | - |
| tablet | /beta | 200 | - | - | - |
| tablet | /force | 200 | `THREE.Clock deprecated` | - | - |
| tablet | /vieve | 200 | `THREE.Clock deprecated` | - | - |
| tablet | /team | 404 | 404 resource error | - | `404 /team` |
| tablet | /app/login | 200 | - | `/beta?_rsc=1d15x`, `/beta?from=login&_rsc=19umo :: net::ERR_ABORTED` | - |
| tablet | /does-not-exist | 404 | 404 resource error | - | `404 /does-not-exist` |
| desktop | / | 200 | - | `/beta?_rsc=1r34m :: net::ERR_ABORTED` | - |
| desktop | /beta | 200 | - | - | - |
| desktop | /force | 200 | `THREE.Clock deprecated` | - | - |
| desktop | /vieve | 200 | `THREE.Clock deprecated` | `/beta?from=nav&_rsc=tv716 :: net::ERR_ABORTED` | - |
| desktop | /team | 404 | 404 resource error | - | `404 /team` |
| desktop | /app/login | 200 | - | `/beta?from=login&_rsc=19umo :: net::ERR_ABORTED` | - |
| desktop | /does-not-exist | 404 | 404 resource error | - | `404 /does-not-exist` |

Titles / h1 (identical across viewports): `/` "RowTech: the force curve from every seat in the boat" / h1 "Making imperative data available to everyone, seat by seat."; `/beta` "Apply for the beta | RowTech" / "Apply for the beta."; `/force` "Force, the seat node | RowTech" / "Force, the seat node."; `/vieve` "Vieve, the RowTech cox box | RowTech" / "Vieve, the RowTech cox box."; `/team` and `/does-not-exist` site default title / h1 "404"; `/app/login` "Sign in · RowTech" / "Sign in". h1 count = 1 on every page.

#### Appendix B: axe-core results (WCAG 2.x A/AA + best-practice tags), desktop and mobile

| Page | Viewport | Violations | Incomplete (needs review) |
|---|---|---|---|
| / | mobile | none | color-contrast (111 nodes, SVG text) |
| / | desktop | none | color-contrast (105) |
| /beta | mobile | none | none |
| /beta | desktop | none | none |
| /force | mobile | none | color-contrast (22) |
| /force | desktop | none | color-contrast (51; 3D note text over `bg-foreground/[0.03]`) |
| /vieve | mobile | none | color-contrast (43) |
| /vieve | desktop | none | color-contrast (56) |
| /app/login | mobile | **serious** `link-in-text-block` x1: `.text-trace` `<a data-cta="login" class="text-trace underline-offset-4 hover:underline" href="/beta?from=login">Apply for the beta</a>` - link/surrounding contrast 1.82:1 (#22e3ef vs #8d9aa6), no underline | none |
| /app/login | desktop | same as mobile | none |
| /team, /does-not-exist | mobile + desktop | **moderate** `landmark-one-main` x1 (`html`: no main landmark); **moderate** `region` x2 (`h1.next-error-h1`, `div:nth-child(2) > div > div` (h2) outside landmarks) | none |

Tablet was not axe-scanned (brief asked for desktop and mobile). Full node lists: `ux-results.json` -> `<viewport> <page>.axe`.

#### Appendix C: heading outlines (desktop; identical on other viewports)

- `/`: H1 Making imperative data available to everyone, seat by seat. / H2 See whose catch is early, and who's carrying the boat. / H2 How an outing gets from the rigger to your phone. / H3 Fit a node to each seat / H3 Row / H3 Download the practice / H2 One stroke, taken apart. / H2 Two products, one system. / H3 Force, the seat node / H3 Vieve, the RowTech cox box / H2 Where the build stands. / H3 In the node's firmware now / H3 The team dashboard / H3 Coming next / H2 Questions a coach might ask. / H2 Applying for the beta. / H3 Who it's for / H3 Applying / H3 What beta crews get / H2 Tell us about your crew.
- `/beta`: H1 Apply for the beta. (only heading)
- `/force`: H1 Force, the seat node. / H2 What the rower sees on the water. / H2 It brings its own network to the dock. / H2 Specifications. / H2 Try Force in the beta.
- `/vieve`: H1 Vieve, the RowTech cox box. / H2 One clock for the whole crew. / H2 What's on it, and in it. / H2 Specifications. / H2 Beta crews get a direct line to the people building Vieve.
- `/app/login`: H1 Sign in
- 404: H1 404 / H2 This page could not be found.
No level skips on any page.

#### Appendix D: keyboard tab order (desktop 1440x900, first 15 stops; `ind` = visible focus indicator)

`/`: 1 a "RowTech home" ind / 2 a "How it works" / 3 a "One stroke" / 4 a "Force" / 5 a "Vieve" / 6 a "FAQ" / 7 a "Apply for the beta" (header) / 8 a "Apply for the beta" (hero, 160x48) / 9 a "See Force" (63x15) / 10 div[role=region] "Crew view illustration…" / 11-15 buttons "Catch: ≈3 ms", "Rise rate: 245 kg/s", "Peak & position: 61.4 kg at 36%", "Consistency: CV 1.8%", "Work by thirds: 33 / 47 / 19 %". All 15: `ind=true`, `:focus-visible` matched, outline `solid 2px rgb(230,235,237)`.

`/beta`: 1-6 header (logo + 5 nav; no CTA on this page) / 7 input#name / 8 input#email / 9 input#organization / 10 summary "Tell us about your boat…" (outline `2px rgb(34,227,239)`) / 11 button "Apply for the beta" / 12-15 footer links. Optional fields are skipped while the `<details>` is closed (expected). Inputs: outline none but `box-shadow` ring (`focus:ring-3`), counted as visible.

`/app/login`: 1 a "RowTech home" / 2 a "Apply for the beta" (inline text link) / 3 button "Continue with Google" / 4 input#email / 5 button "Email me a link" / 6 body (wraps) / 7 logo again. All with cyan outline `2px rgb(34,227,239)`.

Mobile menu tab order (375px, menu open, from the summary): How it works, One stroke, Force, Vieve, FAQ, then out into "Apply for the beta" (header), "Apply for the beta" (hero), "See Force", crew region; menu stays open.

#### Appendix E: touch targets < 44x44 CSS px at 375px (full lists)

- `/` (19): a "RowTech home" 28x35 @(16,15); summary "Menu" 56x40 @(155,12); a "Apply for the beta" 140x40 @(219,12); a "See Force" 63x15 @(245,881); button "Catch: ≈3 ms" 28x28 @(68,3907); button "Rise rate: 245 kg/s" 28x28 @(68,3952); button "Peak & position: 61.4 kg at 36%" 28x28 @(201,3883); button "Consistency: CV 1.8%" 28x28 @(255,3912); button "Work by thirds: 33 / 47 / 19 %" 28x28 @(165,3952); button "Release: ½ threshold" 28x28 @(297,3931); button "Rhythm: 1 : 1.70" 28x28 @(302,3959); a "See Force and its specifications" 232x17 @(20,5145); a "See Vieve and its specifications" 231x17 @(20,5630); footer a "How it works" 78x20 @(20,9960); a "Force" 36x20 @(122,9960); a "Force specifications" 124x20 @(182,9960); a "Vieve" 35x20 @(20,9988); a "Vieve specifications" 123x20 @(79,9988); a "The beta" 54x20 @(226,9988).
- `/beta` (8 + honeypot): logo 28x35; summary "Menu" 56x40 @(303,12); footer links as above (y=1074/1102); input#website 181x24 @(-9999,746) (honeypot, off-screen by design).
- `/force` (16): logo, Menu, header CTA; 3D dots button "1".."7" 24x24 (aria-hidden, tabIndex -1; e.g. @(104,852), (125,867), (64,936), (176,830), (206,881), (257,923), (256,955)); footer links (y=4399/4427).
- `/vieve` (12): logo, Menu, header CTA; 3D dots "1".."3" 24x24 @(63,1408), (176,1333), (135,1397); footer links (y=3314/3342).
- `/app/login` (2): a "RowTech home" 28x35 @(20,187); a "Apply for the beta" 321x40 @(20,302).
- Tablet/desktop header nav links are 36px tall (52-102 wide), footer links 20px tall at every viewport.

#### Appendix F: link crawl (same-origin `<a href>` from `/`, `/beta`, `/force`, `/vieve`, `/team`, `/app/login`, plus common paths; `maxRedirects: 0`)

```
200 https://www.rowtech.app/
200 https://www.rowtech.app/beta?from=closing
200 https://www.rowtech.app/beta?from=force
200 https://www.rowtech.app/beta?from=hero
200 https://www.rowtech.app/beta?from=login
200 https://www.rowtech.app/beta?from=nav
200 https://www.rowtech.app/beta?from=stroke
200 https://www.rowtech.app/beta?from=vieve
200 https://www.rowtech.app/force
200 https://www.rowtech.app/vieve
404 https://www.rowtech.app/team
404 https://www.rowtech.app/robots.txt
404 https://www.rowtech.app/sitemap.xml
404 https://www.rowtech.app/privacy
404 https://www.rowtech.app/terms
200 https://www.rowtech.app/og.png
200 https://www.rowtech.app/icon.svg
404 https://www.rowtech.app/favicon.ico
307 https://www.rowtech.app/app -> /app/login
307 https://www.rowtech.app/app/force -> /app/login
307 https://www.rowtech.app/app/cox -> /app/login
```
No redirect chains longer than one hop; no broken links among those actually linked from the pages. Anchor ids: `how`, `stroke`, `faq`, `beta`, `crew`, `products`, `beta-scope` exist on `/`; `specs` exists on `/force` and `/vieve` (`anchors` in `flow-log2.txt`, `exists: true` for all).

#### Appendix G: screenshots index (in `shots/`)

- Full page per viewport (note FMT-006: blank below the fold on `/`): `home-{mobile,tablet,desktop}.png`, `beta-*.png`, `force-*.png`, `vieve-*.png`, `team-*.png`, `app_login-*.png`, `does-not-exist-*.png`.
- Reliable viewport tiles: `vp-home-m-00..12.png` (375px), `vp-force-m-00..05.png`, `vp-vieve-m-00..04.png`, `vp-home-d-00..11.png` (1440px).
- Flow: `flow-01-landing-375-viewport.png`, `flow-02-beta-375-viewport.png`, `flow-02-beta-375-full.png`, `flow-03-beta-375-details-open.png`, `flow-04-beta-375-invalid-email.png`, `flow-05-beta-375-chip-checked.png`, `flow-05a-beta-375-chip-focus.png`, `flow-06-mobile-menu-open.png`, `flow-06b-mobile-menu-open-clip.png`, `flow-07-after-menu-faq.png`, `flow-08-faq-summary-focus.png`.
- Keyboard: `tab-home-stop3.png`, `tab-home-stop8.png`, `tab-_beta-stop3.png`, `tab-_app_login-stop3.png`, `tab-_app_login-stop8.png`.
- No JS: `nojs-home-desktop.png`, `nojs-force-desktop.png`, `nojs-vieve-desktop.png`, `nojs-beta-desktop.png`.
- Motion / scheme: `force-3d-reduced-motion.png`, `home-desktop-light-scheme.png`, `beta-desktop-light-scheme.png`, `404-desktop-light-scheme.png`.
- Formatting: `fmt-explorer-375-overlap.png`.

---

#### Couldn't check

- Submitting the beta form (success state `Done`, server-side error rendering, focus after error, the `key` remount in UX-006, honeypot behaviour, double-submit race): forbidden (writes to `beta_signups`). Owner can test locally with `BETA_DRY_RUN=1 npm run build && npm start` as `tests/*.spec.ts` do.
- Submitting the login form / magic-link "sent" state / Google OAuth flow: forbidden (sends real email). The pending/disabled logic was read from `app/app/login/login-form.tsx` only.
- Anything behind the gate (`/app/force` upload form, history panel, session viewer, `/app/cox`): 307 to `/app/login` without a beta account. Upload/history/delete findings are code-only (UX-008, UX-009, UX-010).
- Real device testing (iOS Safari, Android Chrome), real screen readers (VoiceOver/NVDA/TalkBack): only Chromium headless with axe and ARIA snapshots. A11Y-004's announcement wording is therefore SUSPECTED.
- Lighthouse / PageSpeed Insights: Lighthouse is not installed and `npx lighthouse` would download a package; PSI was not called. Timings in UX-016 are from an unthrottled desktop connection and are not comparable to mobile field data.
- Colour contrast of SVG `<text>` inside the device illustrations (axe `incomplete`, 105-111 nodes on `/`): needs a manual check with a contrast picker; DOM text passed my automated sweep.
- Tablet was screenshotted and overflow-checked but not axe-scanned or keyboard-walked (brief asked for desktop and mobile).
- Firefox/WebKit: Chromium only. `<details>`-based menu and `content-visibility` behaviour differ by engine (Safari only added `content-visibility` in 18), so UX-001 may present differently there.
- Print stylesheet: not tested.


## 3.7 Performance (PERF) and 3.8 SEO

### PERF-001 three.js (249 kB gzip) is downloaded and executed on every /force and /vieve visit, right after hydration
- Severity: High
- Status: CONFIRMED
- Location: components/site/device-diagram-3d.tsx:12 (`dynamic(() => import("@/components/device3d/scene"), { ssr: false })`) and :49-57 (`IntersectionObserver` with `rootMargin: "600px"`); app/force/page.tsx:504-515; app/vieve/page.tsx:609-620; components/device3d/scene.tsx:4-6 (imports `@react-three/fiber`, `@react-three/drei` Html/Line/RoundedBox, `three`)
- What's wrong and why it matters: The 3D diagram is "lazy" in name only. It sits in the second section of both product pages, within 600 px of the viewport at load on every screen size, so the observer fires immediately after hydration. Lighthouse shows the chunk `0hfmv-hnhhv63.js` (946,603 B raw, 249,036 B gzip; contains `three`, `@react-three/fiber`, `@react-three/drei`) requested at 669 ms on /force mobile and 973 ms on /vieve mobile. It is the single largest cost on the site: /force mobile Perf 67, TBT 2,660 ms, TTI 6.4 s, bootup 3,117 ms in that chunk, 89 KiB of it unused; /vieve mobile Perf 66, TBT 3,020 ms, TTI 6.9 s; /force desktop Perf 79, TBT 460 ms (2,442 ms of script evaluation in the chunk). The same chunk causes the `forced-reflow` insight on /force (45.5 ms attributed to `0hfmv-hnhhv63.js:353`). Compare /vieve desktop, where the chunk arrived after the trace window and the page scores 99. Total page weight 597 KiB vs 336-372 KiB on the pages without it.
- Evidence: `scratchpad/lh/parsed.txt` (force mobile: "unused-js top: 0hfmv-hnhhv63.js total 177kB wasted 89kB", "bootup top: 0hfmv-hnhhv63.js 3117ms", "long tasks: 0hfmv-hnhhv63.js 853ms, 527ms"); lh-detail output "lazy chunk requested: 0hfmv-hnhhv63.js start 669 ms end 707 ms 252 kB"; `gzip -9c .next/static/chunks/0hfmv-hnhhv63.js | wc -c` = 249036.
- Suggested fix: Load the scene on intent instead of proximity: keep the poster and notes server-rendered and fetch the chunk on the first pointerenter/focus/tap on the stage (or a "Turn the model" button), or at minimum `rootMargin: "0px"` plus `requestIdleCallback` after `load`. Separately, import drei components from their subpaths so the chunk carries less unused code.
- Effort: S (intent-gated load) / M (trimming drei)

### PERF-002 /beta, the conversion page, is dynamically rendered on every request (no CDN cache, a function invocation per hit and per prefetch)
- Severity: Medium
- Status: CONFIRMED
- Location: app/beta/page.tsx:419-426 (`const q = await searchParams; ... q.from`); live headers for https://www.rowtech.app/beta
- What's wrong and why it matters: Reading `searchParams` in the page opts the whole route out of prerendering. Live response: `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`, `X-Vercel-Cache: MISS`, `X-Powered-By: Next.js`, `X-Vercel-Id: cle1::iad1::...` (a function invocation in iad1), whereas /, /force, /vieve are `X-Nextjs-Prerender: 1`, `X-Vercel-Cache: HIT`, `Age: 536`. Every visit to the beta form, and every Next `<Link>` prefetch of it (the home page issues 5 prefetches for `/beta?from=hero|nav|...`, see PERF-007), invokes a function; TTFB is subject to cold starts and region latency. The page also loses bfcache eligibility (`no-store`). The only dynamic input is the `from` attribution tag, which the client already has (`components/site/attribution.tsx` stores first-touch attribution in sessionStorage, and `analytics.tsx` reads `data-cta`).
- Evidence: `scratchpad/live/beta.headers`; `.next/server/app/` contains `force.html`, `vieve.html`, `index.html` but no `beta.html`.
- Suggested fix: Make /beta static: read `from` in the client (`useSearchParams()` inside a `<Suspense>` in `SignupForm`, or `location.search` on mount into a hidden input) and keep the sanitisation there; or drop the query parameter entirely and pass `from` through the existing sessionStorage attribution.
- Effort: S

### PERF-003 Home page's own JavaScript costs ~2.7 s of CPU on mobile: the hero screen animator runs a 60 fps rAF loop that mutates an inline SVG every frame from hydration onward
- Severity: Medium
- Status: CONFIRMED (cost) / SUSPECTED (attribution to the animator)
- Location: components/device/screen-animator.tsx:28-99 (rAF loop, `sweep.setAttribute`, `cursor.setAttribute`, `peak.textContent` every frame; `resume()` called synchronously in `useEffect`); components/site/hero.tsx:47 (`<ScreenAnimator target="hero" />`)
- What's wrong and why it matters: Lighthouse attributes 2,680 ms (mobile, 4x CPU) / 665 ms (desktop) of bootup time to the home page chunk `06ac0qdm88p37.js` (7.1 kB gzip: page code, islands loader, animator), and the main-thread breakdown on mobile is Style & Layout 2,076 ms, Other 2,398 ms, Script 1,719 ms. Home mobile TBT is 820 ms against a ~400 ms machine floor, Perf 76 vs 85 for /beta and 86 for /app/login on the same run. The animator starts in `useEffect` immediately after hydration and keeps running while the hero is on screen; each frame writes attributes on an SVG inside a `[transform:rotateY(-11deg)...]` figure with `drop-shadow`, forcing style recalculation and paint for the hero every frame, and it does the same writes during the recovery phase where nothing changes. PERF.md describes the previous design as "loads after `load` + idle"; the current animator does not wait. (It does pause off-screen and on `document.hidden`, screen-animator.tsx:80-94, and respects reduced motion.)
- Evidence: `scratchpad/lh/parsed.txt` home mobile ("bootup top: 06ac0qdm88p37.js 2680ms; [document] 2592ms", "main-thread: Other 2398ms; Style & Layout 2076ms"), home desktop ("bootup top: [document] 1020ms; 06ac0qdm88p37.js 665ms"); `.next/static/chunks/06ac0qdm88p37.js` contains `requestAnimationFrame`, `screen`, `island`.
- Suggested fix: Start the animator after `load` + `requestIdleCallback` (as PERF.md intended); skip DOM writes when the value has not changed (recovery and wipe phases); consider 30 fps or moving the sweep and cursor to CSS/Web Animations (the ScopeStrip already uses a CSS sweep). Re-measure with PSI.
- Effort: S

### PERF-004 Initial JavaScript is 157 kB gzip on / and 163-165 kB on every other page, against the 120 kB target; page-owned share is ~12 kB
- Severity: Low
- Status: CONFIRMED
- Location: live HTML `<script src>` tags (11 on /, 12 elsewhere); `.next/build-manifest.json` rootMainFiles
- What's wrong and why it matters: Every page ships the same framework floor: react-dom (`110q6k5sdl4es.js` 63.8 kB), Next App Router runtime (`17ifqohi3e9gj.js` 37.2 kB), `0t2xr05rlu96l.js` 12.8 kB, `07uz2g0_38qia.js` 9.1 kB, `029295~mgs1j_.js` 8.8 kB, `0c.utrj~l6_28.js` 7.3 kB, turbopack runtime 4.4 kB, `03edqrb4zdj~g.js` 2.0 kB = 145.4 kB. Page-owned on /: `06ac0qdm88p37.js` 7.1 kB (page + islands + animator) and `0_xt5wewagvho.js` 4.5 kB (Vercel Analytics + Speed Insights + PostHog loader). The 39.4 kB `03~yq9q893hmn.js` core-js polyfill is `noModule` and is not fetched by modern browsers. This matches PERF.md's conclusion (framework floor ~150 kB; the 120 kB target is not reachable on App Router) and is recorded, not a regression. The login page (a heading and two fields) still ships 163 kB because the root layout's analytics components and `AttributionCapture` are client components on every route.
- Evidence: chunk table in Appendix B (sizes from `gzip -9` over the live files in `scratchpad/live/chunks/`).
- Suggested fix: Nothing structural. Optionally move `AttributionCapture`/`ProductAnalytics` out of /app routes (marketing-only) to shave ~4.5 kB there.
- Effort: S

### PERF-005 Home HTML is 198 kB because the 78 kB of server-rendered markup (44 kB of inline SVG) is serialised a second time in the RSC payload (117 kB across 37 inline scripts)
- Severity: Low
- Status: CONFIRMED
- Location: app/page.tsx (island fallbacks `fallback={<CurveExplorerView active="catch" />}` :265-267 and the device placeholders :118, :132; `<ForceScreen idPrefix="step" />` :239; `<ForceMount>` :235); components/site/hero.tsx (inline `<ForceDevice>`)
- What's wrong and why it matters: Anatomy of `scratchpad/live/home.html`: 198,218 B total; `self.__next_f.push` RSC payload 116,846 B in 37 `<script>` tags; visible markup 77,982 B (729 elements) of which inline `<svg>` 43,688 B in 10 SVGs; by section: stroke 23.8 kB, how 14.5 kB, hero 13.6 kB, crew 10.2 kB. No single path is over 2 kB (the RDP simplification from PERF.md holds: largest `d` attribute 413 chars), so this is not the old full-resolution-curve problem; it is the inherent App Router cost of markup passed as props to client components (island fallbacks) plus the RSC tree itself. On the wire Vercel serves brotli 28.6 kB (gzip 36.6 kB), so transfer is fine; the cost is parsing 39 inline scripts and hydrating 729 elements: Lighthouse attributes 2,592 ms (mobile) / 1,020 ms (desktop) of bootup to the document itself. An improvement on PERF.md's 268 kB. `<img>`/`next/image` are not used anywhere (`grep` found none), so `unoptimized` and responsive-image audits are n/a; Lighthouse `modern-image-formats`, `uses-responsive-images` = not applicable on all pages.
- Evidence: `node scratchpad/html-anatomy.js scratchpad/live` output; `curl -H "Accept-Encoding: br"` size 28,569 B.
- Suggested fix: Watch it (budget ~200 kB raw HTML). To shrink: render the three island fallbacks from a server component that the island replaces by id (as the hero animator does), so their SVG is in the HTML once and not in the RSC props.
- Effort: M

### PERF-006 116 kB of web fonts are preloaded on every page; the Archivo variable file (wght + wdth) is the largest transfer on every page
- Severity: Low
- Status: CONFIRMED
- Location: app/layout.tsx:10-20 (`Archivo({ subsets: ["latin"], axes: ["wdth"] })`, `Chivo_Mono({ subsets: ["latin"] })`); live CSS `@font-face` (font-weight 100 900, font-stretch 62% 125%, font-display: swap)
- What's wrong and why it matters: Two preloads per page (`<link rel="preload" as="font">` in HTML on prerendered pages, `Link:` header on /beta and /app/login): `21ca8f3f56c22ca2-s.p...woff2` = 90,096 B (Archivo latin, full weight range plus the width axis) and `387ee14c0e0fe675-s.p...woff2` = 26,380 B (Chivo Mono latin). Lighthouse lists the Archivo file as the biggest single transfer on every page (88 KiB). The width axis is used (globals.css:193 `font-stretch: 72%`, :201 `75%`) and weights 650/760/800 are used, so both axes are needed as designed, but a variable file with two axes is roughly double a single-axis one. Chivo Mono is "device output only" (layout.tsx:16) yet is preloaded on /beta and /app/login where it may not appear above the fold. `font-display: swap` plus size-adjusted fallbacks (`Archivo Fallback` size-adjust 98.7%) are in place; Lighthouse `font-display` passes and CLS is 0. Four further subset files (latin-ext, vietnamese; 9.8-85.9 kB) exist but are only fetched when their unicode-range is hit.
- Evidence: `scratchpad/live/home.html` preload lines; `curl -s -o /dev/null -w "%{size_download}"` on each `/_next/static/media/*.woff2`; Lighthouse "biggest transfers".
- Suggested fix: Either accept (fonts are cached immutable for a year) or drop the `wdth` axis and use a static condensed cut for the two heading styles, and load Chivo Mono without preload on pages that do not show device output (`preload: false` or a route-level font).
- Effort: S

### PERF-007 Link prefetching fires 13-17 RSC fetches per home visit, including 5 to the dynamic /beta route
- Severity: Low
- Status: CONFIRMED
- Location: app/page.tsx (BetaLink/`<Link>` instances), components/site/site-header.tsx, components/site/cta.tsx; live home page links `/beta?from=hero`, `/beta?from=nav`, `/beta?from=stroke`, `/beta?from=closing`, `/force` x5, `/vieve` x4
- What's wrong and why it matters: Lighthouse network log for / (mobile): 13 `Fetch` requests, all Next prefetches: `/force?_rsc=` x4, `/?_rsc=` x3, `/beta?from=hero&_rsc=` x2, `/beta?from=nav&_rsc=` x2, `/beta?_rsc=` x1 (desktop: 17, adding `/vieve` x3). Next 16's segment prefetch issues several requests per route, and every distinct `/beta?from=` URL is a separate prefetch that invokes a function (PERF-002). This costs bandwidth on mobile and function invocations on every marketing page view.
- Evidence: `scratchpad/lh/lh-home-mobile.json` `network-requests` (printed by lh-detail: "fetches: ...").
- Suggested fix: One canonical `/beta` href everywhere with `from` carried on `data-cta` (already tracked by analytics.tsx) or sessionStorage attribution; `prefetch={false}` on repeated CTAs below the fold; making /beta static (PERF-002) removes the function cost of the remaining prefetches.
- Effort: S

### PERF-008 `public/` assets (icon.svg, og.png) are served with `max-age=0`, so the favicon is revalidated on every navigation despite its hashed URL
- Severity: Low
- Status: CONFIRMED
- Location: next.config.ts (no `headers()`); live `https://www.rowtech.app/icon.svg` and `/og.png`
- What's wrong and why it matters: Both respond `Cache-Control: public, max-age=0, must-revalidate` (icon.svg 413 B, og.png 103,931 B, 1200x630 PNG). The page references the icon as `/icon.svg?icon.157rrtu1p5a8w.svg`, i.e. content-addressed, so it could be cached for a year. og.png is only fetched by link unfurlers; a 104 kB PNG is acceptable for an OG image (WebP is not universally supported by scrapers). Next's own `/_next/static/*` are correctly `public,max-age=31536000,immutable`.
- Evidence: `curl -sD - https://www.rowtech.app/icon.svg` and `/og.png` (this audit's output).
- Suggested fix: Add a `headers()` entry in next.config.ts for `/icon.svg` and `/og.png` (e.g. `public, max-age=86400, stale-while-revalidate=604800`).
- Effort: S

### PERF-009 Query fan-out on the session page: three sequential Supabase round trips per seat, one seat after another
- Severity: High (scales with crew size; Medium at today's data volume)
- Status: CONFIRMED
- Location: app/app/(dash)/force/[id]/page.tsx:39-56
- What's wrong and why it matters: For each member: `await` strokes select (:40-44), then `await` session_files select (:45), then `await createSignedUrl` (:46). An eight-seat crew is 2 + 8x3 = 26 serial round trips from the Vercel function (iad1) to Supabase and Storage before any HTML is sent; at 30-80 ms each that is 0.8-2 s of pure latency on a page that also streams nothing (no `loading.tsx`, no Suspense boundaries). Each strokes query is also RLS-checked per row via `exists (select 1 from sessions ... is_team_member(...))` (supabase/migrations/20260922180943_session_model.sql:157).
- Evidence: the `for (const m of members)` loop with three `await`s inside at the lines above.
- Suggested fix: One query each: `strokes.in("session_id", ids).order("session_id").order("rec")`, `session_files.in("session_id", ids).eq("kind","curves")`, and `storage.from("sessions").createSignedUrls(paths, 3600)` (batch API), then group in memory; or `Promise.all` over seats as a minimum. Add a `loading.tsx` to the (dash) segment so the shell streams.
- Effort: S

### PERF-010 Crew page repeats the per-seat serial pattern and serialises up to 20,000 GPS points into the page
- Severity: High (scales) / Medium today
- Status: CONFIRMED
- Location: app/app/(dash)/cox/[id]/page.tsx:37-55 (per kid: strokes `await`, then `seats` lookup `await`), :57-62 (`gps_points ... .limit(20000)`), :80-85 (`track` passed as a prop to the client `CrewView`)
- What's wrong and why it matters: Same N+1 as PERF-009 (2 serial queries per seat, 8 seats = 16 round trips plus 3). The GPS query then returns up to 20,000 rows x 5 columns which are serialised into the RSC payload as props of the client `CrewView` (~60 B per point as JSON = ~1.2 MB before compression at the limit). The `seats` lookup per kid is needless: it is one `seats.eq("boat_id", ...)` query.
- Evidence: lines cited; gps_points PK is `(session_id, t_ms)` (vieve_gps.sql:225) so the query itself is indexed.
- Suggested fix: Parallelise with `Promise.all`; fetch seats once per boat; downsample the track server-side (every Nth point or Douglas-Peucker to ~2,000 points) or load the track on the client on demand when the map is opened.
- Effort: S/M

### PERF-011 Compare page runs the two pieces one after the other (6 serial queries) and ships two 20,000-point tracks
- Severity: Medium
- Status: CONFIRMED
- Location: app/app/(dash)/cox/compare/page.tsx:67-68 (`const a = await piece(...); const b = await piece(...)`), :12-31 (three serial queries inside `piece`), :36-41 (`gps_points ... .limit(20000)`)
- What's wrong and why it matters: The pieces are independent; awaiting them serially doubles latency. Each `piece` also queries `session_stats` by `parent_id` (:24-26), a non-materialised aggregate view (see PERF-012); Postgres may aggregate every visible session before applying the `parent_id` filter, because `parent_id` is not a grouping column (SUSPECTED, needs `EXPLAIN`). Each `PieceMap` then lazy-loads maplibre-gl (280 kB gzip, `0dq.b.~877o8p.js`), which is correctly deferred (components/dash/piece-map.tsx:57-58).
- Evidence: lines cited.
- Suggested fix: `const [a, b] = await Promise.all([piece(qa), piece(qb)])`; downsample GPS as in PERF-010; if the `session_stats` plan is bad, replace the per-parent aggregate with a function taking the parent id.
- Effort: S

### PERF-012 /app/force aggregates every stroke the user can see on every visit (session_stats is a plain view over strokes, RLS-checked per row) and loads 200 + 500 rows regardless
- Severity: Medium (grows linearly with data; small today)
- Status: CONFIRMED
- Location: app/app/(dash)/force/page.tsx:23-35; supabase/migrations/20260922181900_session_stats_view.sql (`create view public.session_stats with (security_invoker = true) ... from sessions s left join strokes k ... group by s.id`); session_model.sql:157 (strokes select policy)
- What's wrong and why it matters: `session_stats` has no materialisation and no stored aggregates; each visit to /app/force runs `count/avg/stddev` over all strokes of all sessions visible to the caller, with the strokes RLS policy (`exists (select 1 from sessions s where s.id = session_id and is_team_member(s.team_id))`) evaluated per stroke row. `.limit(500)` applies after the GROUP BY, so it does not bound the work. At ~1,000 strokes per seat-session, a season of 100 crew outings x 8 seats is ~800k rows aggregated on every page view, plus the 200-session list. Indexes are otherwise adequate: strokes PK `(session_id, rec)` covers the join and the `eq(session_id).order(rec)` reads; `sessions_team_time_idx (team_id, recorded_at desc)` covers the list; `sessions_parent_idx`, `session_files unique (session_id, kind)`, `seats unique (boat_id, seat_number)`, `boats unique (team_id, name)`, `gps_points PK (session_id, t_ms)` cover every lookup in the pages and actions.
- Evidence: view DDL and page queries cited.
- Suggested fix: Store per-session aggregates on `sessions` at upload time (uploadSession already has every stroke in memory; `summarise()` in lib/session/analyse.ts exists) and read those; or a materialised view refreshed from the upload action. Bound the history query by date/count of sessions rather than rows of the view.
- Effort: M

### PERF-013 uploadSession is entirely serial: ~12 round trips per seat, 500-row stroke batches one after another, four file uploads one after another
- Severity: Medium
- Status: CONFIRMED
- Location: app/app/(dash)/force/actions.ts:139-203 (per seat: upsert :141-168, delete strokes :172, `for (i += 500) await insert` :190-193, `for (const [kind...]) await upload; await upsert` :196-202); next.config.ts `serverActions.bodySizeLimit: "25mb"`
- What's wrong and why it matters: For an eight-seat outing of ~1,000 strokes each: 8 x (1 upsert + 1 delete + 2 inserts + 4 uploads + 4 upserts) = 96 serial network calls inside one server action, each stroke insert row RLS-checked via the `exists` subquery. The user sees a spinner the whole time and the action is exposed to the function's `maxDuration` (NEEDS MANUAL CHECK: no `maxDuration` export in the repo, so Vercel's project default applies). `deleteSession` (:209-219) is fine (batched `in()` and one `remove`).
- Evidence: lines cited.
- Suggested fix: `Promise.all` the four uploads per seat and the seats among themselves; insert strokes in one request (PostgREST accepts thousands of rows; or a single RPC taking JSON that inserts and computes the aggregates from PERF-012 in one transaction).
- Effort: S/M

### PERF-014 `revalidatePath` after uploads/deletes/seat changes cannot purge any server cache because every /app route is dynamic; it only clears the client router cache
- Severity: Info
- Status: CONFIRMED
- Location: app/app/(dash)/force/actions.ts:205, :218; app/app/(dash)/cox/actions.ts:14; lib/supabase/server.ts:20 (`await cookies()` in `supabaseServer()`, used by every /app page and the (dash) layout)
- What's wrong and why it matters: Calling `cookies()` makes every /app page render per request (`Cache-Control: private, no-cache, no-store` on /app/login and the 307 on /app confirm this live), so there is no Full Route Cache or Data Cache entry to invalidate. The calls are still useful: a `revalidatePath` from a server action also invalidates the client-side Router Cache so the next navigation to /app/force refetches. Nothing to fix; just do not expect a server-side effect, and do not add `revalidate` exports expecting ISR.
- Evidence: headers in `scratchpad/live/login.headers`; `curl -sD - https://www.rowtech.app/app` (307, private no-store).
- Suggested fix: None required.
- Effort: n/a

### PERF-015 content-visibility is still in place; CLS is 0 on every page except a 0.009 shift on /vieve mobile
- Severity: Info
- Status: CONFIRMED
- Location: app/globals.css:235-238 (`@utility below-fold { content-visibility: auto; contain-intrinsic-size: auto 900px; }`), used by every below-hero section in app/page.tsx; live CSS `07roh5u30w1lk.css` contains `.below-fold{content-visibility:auto;contain-intrinsic-size:auto 900px}`
- What's wrong and why it matters: Verified present and shipped. Lighthouse CLS: 0 on all ten runs except /vieve mobile 0.009 (element: the "One clock for the whole crew" section, `CoxBoxView`). /force and /vieve do not use `below-fold` on their sections, so the offscreen-work benefit applies only to /.
- Evidence: `grep content-visibility` on both files; `scratchpad/lh/parsed.txt` "layout shifts".
- Suggested fix: Optional: apply `below-fold` to the sections after the hero on /force and /vieve too; check the CoxBoxView swap for a reserved box.
- Effort: S

### PERF-016 Caching, compression and redirect behaviour of the prerendered pages (for the record)
- Severity: Info
- Status: CONFIRMED
- Location: live headers in `scratchpad/live/*.headers`
- What's wrong and why it matters: /, /force, /vieve: `Cache-Control: public, max-age=0, must-revalidate`, `X-Nextjs-Prerender: 1`, `X-Nextjs-Stale-Time: 300`, `X-Vercel-Cache: HIT`, `Age` present, `Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch`, `Etag` present. This is Next's standard "CDN caches, browser revalidates" contract; TTFB in Lighthouse was 10 ms root document (warm CDN). Brotli is used (home 28.6 kB br vs 36.6 kB gzip). JS/CSS chunks are `public,max-age=31536000,immutable`. Redirects: `https://rowtech.app/force?utm_source=x&a=1` -> 308 -> `https://www.rowtech.app/force?utm_source=x&a=1` (path and query preserved); `http://rowtech.app/beta?from=test` -> 308 `https://rowtech.app/beta?from=test` -> 308 www (two hops on plain-http apex; Vercel default, negligible); `/force/` -> 308 `/force`; `/index.html` 404. `Access-Control-Allow-Origin: *` on the prerendered pages is noted in the audit brief (security area). Lighthouse `document-latency-insight`: "Avoids redirects", "Server responds quickly".
- Evidence: this audit's curl output.
- Suggested fix: None.
- Effort: n/a

### PERF-017 Third-party and lazy-chunk hygiene is good: PostHog never loads, maplibre and posthog are separate chunks, Vercel Analytics/Speed Insights are small and same-origin
- Severity: Info
- Status: CONFIRMED
- Location: lib/analytics.ts:10-45 (`import("posthog-js")` only with a key, after idle); components/dash/piece-map.tsx:57-58 (`await import("maplibre-gl")`); app/layout.tsx:64-66
- What's wrong and why it matters: The live analytics chunk `0_xt5wewagvho.js` contains no `phc_` key, so posthog-js (`0v7rs0lz8kr5q.js`, 95.8 kB gzip) is never requested; Lighthouse third-party summary is empty on every page. `/_vercel/insights/script.js` (2.1 kB) and `/_vercel/speed-insights/script.js` (4.7 kB) are 200 and same-origin, plus one `/16f559f0463d1c49/view` beacon. maplibre-gl (`0dq.b.~877o8p.js`, 279.9 kB gzip, plus `0_v..s71mx2f0.css` 82.9 kB raw) is only imported on the dashboard map. fflate is only in the server action path (lib/session/collect.ts:4), not in any client chunk. `legacy-javascript` flags 14 KiB in `0c.utrj~l6_28.js` (Next's own runtime transforms) and the 39 kB core-js polyfill is `noModule`, so neither is actionable.
- Evidence: chunk grep output in this audit; Lighthouse `third-party-summary`.
- Suggested fix: None.
- Effort: n/a

---

#### SEO

### SEO-001 /beta's canonical URL points to the home page, so search engines will treat the beta application page as a duplicate of /
- Severity: High
- Status: CONFIRMED
- Location: app/layout.tsx:32 (`alternates: { canonical: "/" }` in the root layout metadata); app/beta/page.tsx:413-417 (metadata without `alternates`); live `https://www.rowtech.app/beta` head: `<link rel="canonical" href="https://www.rowtech.app"/>`
- What's wrong and why it matters: Next merges `alternates` from parent metadata, so any route that does not set its own canonical inherits "/" resolved against `metadataBase`. /force and /vieve set theirs (app/force/page.tsx:454, app/vieve/page.tsx:571) and are correct (`https://www.rowtech.app/force`, `/vieve`). /beta does not, and neither do /app/login nor the 404 page (both `noindex`, so harmless there). A canonical to the home page is an explicit signal that /beta is a duplicate of /; Google will generally honour it and drop /beta from the index, so "rowtech beta"/"apply" searches land on the home page. Lighthouse SEO on /beta is 91 with the audit `canonical`: "Points to the domain's root URL (the homepage), instead of an equivalent page of content".
- Evidence: `scratchpad/live/beta.html` (grep `rel="canonical"`); `scratchpad/lh/parsed.txt` beta mobile/desktop "canonical audit: 0".
- Suggested fix: Add `alternates: { canonical: "/beta" }` to app/beta/page.tsx, and move the root `alternates.canonical: "/"` from app/layout.tsx to app/page.tsx so no future route inherits it.
- Effort: S

### SEO-002 Open Graph and Twitter tags on /beta, /force, /vieve and /app/login are the home page's (title, description and og:url all say home)
- Severity: Medium
- Status: CONFIRMED
- Location: app/layout.tsx:33-48 (root `openGraph` and `twitter` objects with `title`, `description`, `url: "/"`); app/beta/page.tsx, app/force/page.tsx, app/vieve/page.tsx (no `openGraph`/`twitter` in their metadata)
- What's wrong and why it matters: Live /force head: `og:title` "RowTech: the force curve from every seat in the boat", `og:description` "Seat-by-seat force measurement for rowing. Coaches: apply for the beta.", `og:url` "https://www.rowtech.app", identical on /beta and /vieve. Sharing the Force page on LinkedIn/Slack/iMessage shows the home headline, and `og:url` tells Facebook's graph the shared object is the home page (shares are attributed there and the unfurl may link to /). The `<title>` and meta description are page-specific, so plain search snippets are fine; only the social/unfurl layer is wrong.
- Evidence: `scratchpad/live/force.html`, `vieve.html`, `beta.html` meta lines (extracted in this audit).
- Suggested fix: Give each page its own `openGraph: { title, description, url: "/force" }` and `twitter: { title, description }` (a helper in lib/site.ts can build them from the page title/description), and keep only `siteName`, `locale`, `type`, `images` at the root.
- Effort: S

### SEO-003 No robots.txt and no sitemap.xml (both 404); /app and /auth are not disallowed for crawlers
- Severity: Medium
- Status: CONFIRMED
- Location: app/ has no robots.ts or sitemap.ts; live `/robots.txt` and `/sitemap.xml` return the Next 404 page (12,927 B, `X-Matched-Path: /404`)
- What's wrong and why it matters: A missing robots.txt is treated as "allow all", so nothing is blocked from crawling today (fine for the four public pages), but the private routes rely on `<meta name="robots" content="noindex">` which is only seen after the crawler fetches them, and /auth/callback has no noindex at all. Without a sitemap, discovery relies on internal links only (adequate for 4 URLs, but a sitemap also gives Search Console per-URL indexing status and `lastmod`). Lighthouse's `robots-txt` audit reports null.
- Evidence: `scratchpad/live/robots.headers`, `sitemap.headers` (404).
- Suggested fix: Add `app/robots.ts` (allow `/`, disallow `/app/`, `/auth/`; `sitemap: https://www.rowtech.app/sitemap.xml`) and `app/sitemap.ts` listing `/`, `/force`, `/vieve`, `/beta`. Submit the sitemap in Search Console.
- Effort: S

### SEO-004 /team now returns 404 with no redirect, after being linked from every page until today; the 404 page is Next's default (two `<title>` elements, no site chrome)
- Severity: Medium
- Status: CONFIRMED (404) / NEEDS MANUAL CHECK (whether /team was indexed or linked externally)
- Location: commit aba1b1a "site: remove the team page for now" (deletes app/team/page.tsx, header/footer links, founders in JSON-LD); live `https://www.rowtech.app/team` -> 404, `Last-Modified: Thu, 24 Sep 2026 14:59:52 GMT`; no app/not-found.tsx in the repo; no `redirects()` in next.config.ts
- What's wrong and why it matters: the audit brief recorded /team as serving 200 at the start of the audit; the removal deployed during it. Any Google-indexed copy, social post, or email that links to /team now hits a bare 404 whose HTML contains `<title>404: This page could not be found.</title>` followed by the root layout's `<title>RowTech: ...</title>` (two title elements, invalid HTML) and no header, nav or link back. The page is `noindex` and served `public, max-age=0` (fine). The commit message says the page will come back, which argues for a temporary (307) redirect to / rather than a permanent one.
- Evidence: `scratchpad/live/team.headers`, `team.html` (grep `<title>` shows two); `git show --stat aba1b1a`.
- Suggested fix: Add a `redirects()` entry for `/team` -> `/` (temporary while it is coming back) in next.config.ts, and an `app/not-found.tsx` using `SitePage` with links to /, /force, /vieve and /beta. Check Search Console (Pages report) and `site:rowtech.app/team` for an indexed copy.
- Effort: S

### SEO-005 Structured data: the Product on /force cannot earn a rich result (no offers/review/aggregateRating), /vieve has none, and the Organization has no sameAs/contactPoint
- Severity: Low
- Status: CONFIRMED
- Location: app/force/page.tsx:470-480 (Product JSON-LD: name, brand, category, image, url, description only); app/vieve/page.tsx:576-578 (`<SitePage>` without `jsonLd`); app/page.tsx:177-189 (Organization: name, url, logo `/icon.svg`, description); components/site/site-page.tsx:8 (renders `jsonLd` when given)
- What's wrong and why it matters: All blocks parse as valid JSON (`JSON.parse` of the live `<script type="application/ld+json">` bodies succeeds) and use absolute `https://www.rowtech.app` URLs, which is correct. But Google's Product documentation requires one of `offers`, `review` or `aggregateRating` for product snippets; as written Search Console will flag "Either 'offers', 'review', or 'aggregateRating' should be specified" and the markup adds nothing. /vieve states a target price ($499) in copy but has no markup at all. The Organization uses the 413-byte square `icon.svg` as `logo` (Google accepts SVG, recommends >= 112x112 and a real logo) and has no `sameAs` or `contactPoint`. Lighthouse's `structured-data` audit is manual, so it reports nothing either way.
- Evidence: live JSON-LD extracted in this audit (home, force); none on vieve/beta/login.
- Suggested fix: Either add `offers` with `availability: https://schema.org/PreOrder` (or `LimitedAvailability`) and `priceCurrency`/`price` where known (Vieve's $499 target), or remove the Product block until there is something to offer; add `sameAs` to the Organization once social profiles exist; consider a 512 px PNG logo.
- Effort: S

### SEO-006 Title template mismatch between the site ("%s | RowTech") and the dashboard ("%s · RowTech"); /vieve title repeats the brand
- Severity: Low
- Status: CONFIRMED
- Location: app/layout.tsx:27 (`template: "%s | RowTech"`); app/app/layout.tsx (`template: "%s · RowTech"`); app/vieve/page.tsx:568 (`title: "Vieve, the RowTech cox box"` -> live `<title>Vieve, the RowTech cox box | RowTech</title>`)
- What's wrong and why it matters: Cosmetic and low-stakes because /app is `noindex`, but the two separators show up in browser tabs and history side by side ("Sign in · RowTech" vs "Apply for the beta | RowTech"). /vieve's title says "RowTech" twice in 36 characters. Titles are otherwise sensible lengths (home 52 chars) and each page has a unique meta description; /app/login inherits the home description (irrelevant under noindex).
- Evidence: live `<title>` values extracted in this audit.
- Suggested fix: Use one template; title Vieve as "Vieve, the cox box" so the template adds the brand once.
- Effort: S

### SEO-007 The home page's only H1 contains none of the terms the page targets
- Severity: Low
- Status: CONFIRMED
- Location: components/site/hero.tsx:19 (`<h1>Making imperative data available to everyone, seat by seat.</h1>`); app/layout.tsx:26,29 (title/description built around "force curve", "rowing", "seat", "cox box")
- What's wrong and why it matters: Heading structure is otherwise clean (exactly one `<h1>` on each of /, /beta, /force, /vieve, /app/login; 8/0/4/4/0 `<h2>`s; Lighthouse `heading-order` passes). But the H1 is the strongest on-page relevance signal after the title, and "imperative data" matches no plausible query; it is also the LCP element on every home run (Lighthouse LCP node = the H1). The product pages' H1s ("Force, the seat node.", "Vieve, the RowTech cox box.") are fine.
- Evidence: `scratchpad/live/home.html` h1; Lighthouse `lcp-breakdown-insight` node path `...MAIN,0,SECTION,0,DIV,0,DIV,0,DIV,0,H1`.
- Suggested fix: Put the product statement in the H1 (e.g. "The force curve from every seat in the boat") and keep the current line as the lead paragraph; copy the owner must confirm (memory: no unconfirmed claims).
- Effort: S

### SEO-008 Seven URL variants of /beta are linked internally (`?from=hero|nav|stroke|closing|login|force|vieve`)
- Severity: Low
- Status: CONFIRMED
- Location: components/site/cta.tsx (BetaLink builds `/beta?from=...`), app/page.tsx:269, :398, components/site/site-header.tsx, app/app/login/page.tsx:681, app/force/page.tsx:549, app/vieve/page.tsx:638
- What's wrong and why it matters: Crawlers see seven distinct URLs for one page. Today they all canonicalise to "/" (SEO-001), which is worse; after SEO-001 is fixed they will consolidate to /beta correctly, but each variant is still crawled and (because /beta is dynamic, PERF-002) each crawl is a function invocation. The `from` value is already captured client-side (`data-cta` on the links, tracked in components/site/analytics.tsx:19-23; first-touch attribution in attribution.tsx), so the URL parameter is redundant for analytics.
- Evidence: live home link inventory (this audit: `/beta?from=stroke`, `?from=nav`, `?from=hero`, `?from=closing`).
- Suggested fix: Link to `/beta` and carry `from` via `data-cta`/sessionStorage into the form's hidden `from_cta` field; if the parameter must stay, SEO-001's canonical makes the variants harmless.
- Effort: S

### SEO-009 /app/login is correctly noindex; /beta is indexable (as it should be) but currently canonicalised away
- Severity: Info
- Status: CONFIRMED
- Location: app/app/layout.tsx (`robots: { index: false, follow: false }`), app/app/login/page.tsx:663 (`robots: { index: false }`); live `<meta name="robots" content="noindex"/>` on /app/login; no robots meta on /, /beta, /force, /vieve
- What's wrong and why it matters: The dashboard tree is noindex (Lighthouse SEO 54 on /app/login is entirely `is-crawlable` + `canonical`, i.e. expected). The login page's own `robots` overrides the layout's, so `nofollow` is dropped there (live shows only `noindex`); harmless. /beta should stay indexable: it is the conversion page and carries the "apply" intent. No `max-image-preview:large`/`max-snippet` directives anywhere (optional).
- Evidence: live meta tags extracted in this audit.
- Suggested fix: None beyond SEO-001.
- Effort: n/a

### SEO-010 og:image is correct: absolute www host, 1200x630, PNG
- Severity: Info
- Status: CONFIRMED
- Location: app/layout.tsx:24 (`metadataBase: new URL(siteUrl)`), lib/site.ts:2-6 (`SITE_URL || VERCEL_PROJECT_PRODUCTION_URL || localhost`); public/og.png
- What's wrong and why it matters: Live `og:image` and `twitter:image` are `https://www.rowtech.app/og.png` on every page (not the apex, not a vercel.app host), so `SITE_URL` is set correctly in production. `public/og.png` is 1200x630 (PNG IHDR read in this audit), 103,931 B: acceptable for unfurlers. `og:image:alt`, `og:locale en_US`, `og:type website`, `twitter:card summary_large_image` are present. No `twitter:site` handle (add when an account exists).
- Evidence: this audit's meta extraction and PNG header read.
- Suggested fix: None.
- Effort: n/a

### SEO-011 Redirects, trailing slashes, hreflang, language (for the record)
- Severity: Info
- Status: CONFIRMED
- Location: live site
- What's wrong and why it matters: apex -> www is a 308 that preserves path and query; `http://rowtech.app/...` takes two 308 hops (https, then www), Vercel's default and fine; `/force/` -> 308 `/force` (single canonical form); `/index.html` 404. `<html lang="en">`; single locale, so hreflang is n/a. Lighthouse `link-text` and `crawlable-anchors` pass on every page; `viewport` present; `http-status-code` 200; `document-title` and `meta-description` pass everywhere.
- Evidence: this audit's curl output; `scratchpad/lh/parsed.txt`.
- Suggested fix: None.
- Effort: n/a

### SEO-012 Minor head hygiene: no theme-color, apple-touch-icon or web manifest; favicon is SVG only
- Severity: Info
- Status: CONFIRMED
- Location: app/ (only icon.svg); live head has one `<link rel="icon" ... type="image/svg+xml">`
- What's wrong and why it matters: Google and modern browsers accept SVG favicons, so search-result favicons should work. iOS home-screen and Safari pinned tabs fall back to a screenshot/letter without `apple-icon.png`/`mask-icon`. Not a ranking matter.
- Evidence: live head extraction.
- Suggested fix: Add `app/apple-icon.png` (180 px) and `themeColor` in metadata when convenient.
- Effort: S

### SEO-013 Accessibility items surfaced by the SEO/perf runs (cross-reference for the a11y auditor)
- Severity: Info
- Status: CONFIRMED
- Location: components/site/curve-explorer-view.tsx (buttons whose visible text differs from their accessible name); app/app/login/page.tsx:681 (link inside text distinguished by colour only)
- What's wrong and why it matters: Lighthouse a11y is 100 on the marketing pages but flags `label-content-name-mismatch` on / (buttons "Catch: ~3 ms", "Rise rate: 245 kg/s", "Peak & position...", "Consistency: CV 1.8%", "Work by thirds...", "Release: 1/2 threshold"); it is not weighted into the score but fails WCAG 2.5.3. /app/login scores 96 with `link-in-text-block` ("Apply for the beta" link relies on colour alone).
- Evidence: `scratchpad/lh/parsed.txt`.
- Suggested fix: Hand to the accessibility findings file.
- Effort: n/a

### SEO-014 Core Web Vitals field data: none available
- Severity: Info
- Status: NEEDS MANUAL CHECK
- Location: n/a
- What's wrong and why it matters: PSI (which would carry `loadingExperience`/CrUX) returned 429 for every call; local Lighthouse has no field data. A site this new and small will almost certainly have no CrUX entry yet (below the traffic threshold). Vercel Speed Insights is installed on every page, so real-user vitals exist in the Vercel dashboard once there is traffic.
- Evidence: `scratchpad/psi/*.json` (429 bodies); `scratchpad/lh/parsed.txt` "CrUX loadingExperience: none".
- Suggested fix: Owner to open Vercel > Project > Speed Insights, and retry PSI with an API key.
- Effort: S

---

#### Appendix A: Lighthouse 13.5.0 scores per page (live site, this workstation, one run each)

Floor on this machine: /app/login (near-empty page) = mobile LCP 2.8 s / TBT 400 ms, desktop LCP 0.6 s / TBT 40 ms. Mobile LCP is 2.7-2.8 s on every page regardless of content, i.e. the machine, not the page; read TBT as (reported - ~400 ms) for the page's own share. The LCP element is the `<h1>` on every marketing page (text, no image).

| page | strategy | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | Speed Index | TTI | Page weight | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| / | mobile | 76 | 100 | 100 | 100 | 1.3 s | 2.7 s | 820 ms | 0 | 2.7 s | 3.5 s | 365 KiB | bootup 06ac0 (page) 2,680 ms + document 2,592 ms; Style&Layout 2,076 ms |
| / | desktop | 97 | 100 | 100 | 100 | 0.5 s | 0.7 s | 120 ms | 0 | 1.3 s | 0.8 s | 372 KiB | |
| /beta | mobile | 85 | 100 | 100 | 91 | 1.4 s | 2.8 s | 430 ms | 0 | 1.7 s | 3.0 s | 336 KiB | SEO: canonical -> home |
| /beta | desktop | 100 | 100 | 100 | 91 | 0.3 s | 0.6 s | 20 ms | 0 | 0.6 s | 0.6 s | 356 KiB | SEO: canonical -> home |
| /force | mobile | 67 | 100 | 100 | 100 | 1.1 s | 2.7 s | 2,660 ms | 0 | 2.5 s | 6.4 s | 597 KiB | three.js chunk 252 KiB at 669 ms; unused JS 89 KiB |
| /force | desktop | 79 | 100 | 100 | 100 | 0.3 s | 0.6 s | 460 ms | 0 | 1.0 s | 1.5 s | 610 KiB | three.js bootup 2,442 ms |
| /vieve | mobile | 66 | 100 | 100 | 100 | 1.4 s | 2.7 s | 3,020 ms | 0.009 | 2.8 s | 6.9 s | 596 KiB | three.js chunk at 973 ms |
| /vieve | desktop | 99 | 100 | 100 | 100 | 0.4 s | 0.7 s | 100 ms | 0 | 0.9 s | 0.7 s | 352 KiB | chunk arrived after the trace window |
| /app/login | mobile | 86 | 96 | 100 | 54 | 1.1 s | 2.8 s | 400 ms | 0 | 1.3 s | 2.8 s | 334 KiB | SEO 54 = noindex (expected) + canonical -> home; a11y link-in-text-block |
| /app/login | desktop | 100 | 96 | 100 | 54 | 0.3 s | 0.6 s | 40 ms | 0 | 0.5 s | 0.6 s | 334 KiB | bf-cache fails (no-store) |

Audits n/a or passing everywhere: `render-blocking-resources` (n/a; the insight version flags only the single 11 kB CSS), `uses-responsive-images`, `modern-image-formats` (no `<img>` on the site), `unused-css-rules` (pass), `font-display` (pass), `uses-long-cache-ttl` (pass), `server-response-time` (10 ms, CDN hit), `redirects` (pass), `errors-in-console` (none), `csp-xss` (informational: no CSP, see security findings), `third-party-summary` (empty).

Against PERF.md's targets: CLS 0 met; LCP < 1.5 s met on desktop (0.6-0.7 s) and unmeasurable on mobile here (machine floor 2.7 s); TBT < 100 ms met on desktop for /, /beta, /vieve, /app/login and not for /force (460 ms, three.js); JS < 120 kB not met (157 kB, framework floor), unchanged from PERF.md.

#### Appendix B: JavaScript chunks (gzip -9 of the live files; raw bytes from `.next/static/chunks`)

Initial (referenced by `<script src>` in the page HTML; `noModule` polyfill excluded from totals):

| chunk | raw | gzip | what | / | /beta | /force | /vieve | /app/login |
|---|---|---|---|---|---|---|---|---|
| 110q6k5sdl4es.js | 203,384 | 63,803 | react-dom | x | x | x | x | x |
| 17ifqohi3e9gj.js | 137,209 | 37,193 | Next App Router runtime, scheduler | x | x | x | x | x |
| 0t2xr05rlu96l.js | 54,646 | 12,788 | Next shared | x | x | x | x | x |
| 07uz2g0_38qia.js | 43,946 | 9,147 | shared UI (cva, header) | x | x | x | x | x |
| 029295~mgs1j_.js | 31,304 | 8,837 | next/dist shared | x | x | x | x | x |
| 0c.utrj~l6_28.js | 24,267 | 7,269 | server-action client runtime (`callServer`); 14 KiB legacy JS per LH | x | x | x | x | x |
| turbopack-0lfj.b-1fd7.y.js | 11,085 | 4,417 | turbopack runtime | x | x | x | x | x |
| 0_xt5wewagvho.js | 13,302 | 4,530 | @vercel/analytics + speed-insights + posthog loader (no key) | x | x | x | x | x |
| 03edqrb4zdj~g.js | 5,364 | 1,972 | root entry | x | x | x | x | x |
| 06ac0qdm88p37.js | 17,228 | 7,096 | home page: islands loader, screen animator | x | | | | |
| 0zig0fh30t6ou.js | 26,520 | 8,188 | shared marketing/product client code | | x | x | x | x |
| 0bn-tlo.-.l6u.js | 19,030 | 7,021 | /beta page (signup form, lucide) | | x | | | |
| 05h9yjygjde9~.js | 15,372 | 5,678 | device-diagram-3d wrapper (product pages) | | | x | x | |
| 172fuqi82w3sg.js | 12,353 | 5,119 | /app/login page (login form, lucide) | | | | | x |
| 03~yq9q893hmn.js | 112,594 | 39,392 | core-js polyfills, `noModule` (not fetched by modern browsers) | (x) | (x) | (x) | (x) | (x) |
| **Initial JS, modern browsers** | | | | **157.1 kB** | **165.2 kB** | **163.8 kB** | **163.8 kB** | **163.3 kB** |

Lazy (not in any page's initial HTML):

| chunk | raw | gzip | what | when |
|---|---|---|---|---|
| 0dq.b.~877o8p.js | 1,049,960 | 279,884 | maplibre-gl (+ 0_v..s71mx2f0.css 82,869 raw) | dashboard map only, `import("maplibre-gl")` in piece-map.tsx:57 |
| 0hfmv-hnhhv63.js | 946,603 | 249,036 | three + @react-three/fiber + @react-three/drei | /force and /vieve, ~0.7-1.0 s after navigation (PERF-001) |
| 0v7rs0lz8kr5q.js | 297,818 | 95,759 | posthog-js | never (no NEXT_PUBLIC_POSTHOG_KEY in production) |
| 0uagejefyxwrd.js / 0xtx4bb1f368r.js / 0kd9jf5i1hl6j.js / 0f631sqgd7oup.js / 0sdxt18hrgd78.js / 04_qg.9q9edi7.js | 6-19 k | 3.8-7.0 k each | islands (curve explorer, force/vieve drawings), dashboard viewers | on proximity/intent or on dashboard routes |

CSS: one stylesheet `07roh5u30w1lk.css` 59,950 B raw / 10,961 B gzip on every page (render-blocking by nature; LH `unused-css-rules` passes). Fonts: see PERF-006.

HTML (live, raw / gzip / brotli): / 198,218 / 35,366 / 21,396 (Vercel sends 28,569 br); /beta 32,297 / 6,062; /force 52,642 / 9,117; /vieve 50,539 / 8,635; /app/login 18,239 / 4,765. Script tags on /: 50 (11 external, 39 inline of which 37 RSC `__next_f.push`). `modulepreload` links: 0 (Next 16 uses async `<script>` tags instead).

#### Couldn't check
- **PageSpeed Insights / CrUX**: every keyless call returned 429 `RESOURCE_EXHAUSTED` with `quota_limit_value: "0"` (raw in `scratchpad/psi/`). Retried after 30 s per the brief; same. Scores above are local Lighthouse on the Windows workstation with PERF.md's floor caveat. Re-run with an API key for authoritative mobile LCP/TBT.
- **Field data (loadingExperience)**: unavailable for the same reason; likely none exists yet. Vercel Speed Insights data was not consulted (no dashboard access used).
- **Whether /team was indexed or externally linked** before today's removal: needs Search Console or a `site:rowtech.app/team` check by the owner.
- **Vercel function `maxDuration`, region and cold-start times** for /beta and the upload action: not inspected (no deployment configuration read); relevant to PERF-002 and PERF-013.
- **Database query plans** (`EXPLAIN ANALYZE` on `session_stats`, the `parent_id` filter push-down in PERF-011, per-row RLS cost): not run; no database access was used. Owner can run `explain (analyze, buffers) select * from session_stats where parent_id = '<id>'` as an authenticated role in the SQL editor.
- **Real-crew data volumes**: the N+1 and aggregation findings are rated on scaling behaviour; with the current sample sessions their measured cost is unknown.
- **Social unfurl rendering** (Facebook/LinkedIn/Slack debuggers) for SEO-002: not exercised; the tag inheritance is verified from the HTML.
- **Interaction latency (INP)** on the 3D diagrams and curve explorer: not measured; Lighthouse's `max-potential-fid` (860-1,050 ms mobile on the product pages) is the proxy.


## 3.9 Code quality and reliability (CODE)

### CODE-001 Session upsert targets a PARTIAL unique index; Postgres cannot infer it, so every node-session upload likely fails
- Severity: High
- Status: CONFIRMED at schema level. **[Lead note]** Live `pg_indexes` shows `sessions_device_uuid_idx` exactly as in the migration (partial, `WHERE device_id IS NOT NULL AND session_uuid IS NOT NULL`) and no full unique constraint on those columns; PostgREST emits `ON CONFLICT (team_id,device_id,session_uuid)` with no index predicate, so Postgres cannot infer the arbiter. The runtime failure itself was not exercised (no writes were made). All dashboard tables are empty in production. See LEAD-004.
- Location: app/app/(dash)/force/actions.ts:135-162; supabase/migrations/20260922180943_session_model.sql:86-89
- What's wrong and why it matters: The upload does `sb.from("sessions").upsert({...}, { onConflict: "team_id,device_id,session_uuid" })`. PostgREST turns that into `INSERT ... ON CONFLICT (team_id, device_id, session_uuid) DO UPDATE`. The only unique index on those columns is partial (`where device_id is not null and session_uuid is not null`). Postgres only infers a partial unique index as an ON CONFLICT arbiter when the conflict target includes a matching `WHERE` predicate, which PostgREST does not emit. The expected outcome is SQLSTATE 42P10 "there is no unique or exclusion constraint matching the ON CONFLICT specification" on every seat-session insert, which the code surfaces to the coach as "The session couldn't be saved: there is no unique or exclusion constraint matching the ON CONFLICT specification". If the crew parent row was already inserted (line 116-129) it is left behind empty (see CODE-004). The home page copy (app/page.tsx:251 "So far it has only run on a made-up sample session") and the skipped upload test (tests/app.spec.ts:23) are consistent with this path never having been exercised end to end against the real schema.
- Evidence: actions.ts:158 `{ onConflict: "team_id,device_id,session_uuid" }`; migration :87-89 `create unique index sessions_device_uuid_idx on public.sessions (team_id, device_id, session_uuid) where device_id is not null and session_uuid is not null;`. No non-partial unique constraint on those columns exists in any migration.
- Suggested fix: Make the index a full unique constraint (`alter table sessions add constraint ... unique (team_id, device_id, session_uuid)`; nulls are distinct so crew rows with null device_id still coexist), or replace the upsert with a select-then-insert/update. To verify first: run `select indexdef from pg_indexes where tablename='sessions'` and attempt one real upload in a non-production project.
- Effort: S (schema) / M (verify + migrate)

### CODE-002 `recorded_at` from a datetime-local input is parsed as server-local time (UTC on Vercel), so the stored time is off by the coach's UTC offset
- Severity: High
- Status: CONFIRMED (by reading)
- Location: app/app/(dash)/force/upload-form.tsx:15-19, :73; app/app/(dash)/force/actions.ts:84-88, :122, :144
- What's wrong and why it matters: The form field is `<input type="datetime-local" name="recorded_at">`, pre-filled by `nowLocal()` with the browser's local wall-clock ("2026-09-24T06:00", no offset). The server action does `new Date(v)`; per ECMAScript, a date-time string without an offset is interpreted in the *host's* local time zone, which on Vercel functions is UTC. A coach in Boston entering 06:00 gets `recorded_at = 06:00Z` (02:00 local) stored. `recorded_at` is the only user-supplied timestamp (the node has no clock) and drives every list ordering, the history chart's x axis, and `toLocaleString()` in three pages. The display then formats with the server's locale/zone too (cox/page.tsx:53, force/page.tsx:70, force/[id]/page.tsx:79, cox/[id]/page.tsx:84, compare/page.tsx:102 all run in Server Components), so the error is invisible on the site itself but wrong in the database, in exports, and anywhere the value is rendered with the real zone. Relative ordering between sessions from the same coach survives; ordering between coaches in different zones does not.
- Evidence: upload-form.tsx:17-18 `d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16);` (local wall clock, no zone) ; actions.ts:86 `const d = typeof v === "string" && v ? new Date(v) : new Date();`
- Suggested fix: Send the zone with the value (a hidden `tz_offset_min` field or convert to ISO with offset on the client before submit) and parse it explicitly on the server; render dates in a client component or with an explicit `timeZone`.
- Effort: S

### CODE-003 `uploadSession` is a non-transactional chain of ~10 writes; every partial failure leaves orphan rows or files
- Severity: High
- Status: CONFIRMED (by reading)
- Location: app/app/(dash)/force/actions.ts:92-207
- What's wrong and why it matters: The action performs, in order and without a transaction: (1) team insert + team_members insert (teamId(), :24-28); (2) boat insert (:107); (3) crew parent session insert (:116-129); (4) per seat: session upsert (:135-161), `strokes.delete` (:166, error ignored), batched `strokes.insert` in 500s (:183-185), storage upload per file (:198-201), `session_files.upsert` (:202, error ignored). Each early `return { status: "error" }` leaves everything before it committed. Partial-failure states reachable by reading the code:
  - team row created, team_members insert fails (:27) -> a team nobody is a member of; next attempt creates another (see CODE-008).
  - boat created, later failure -> harmless but accumulates.
  - crew parent inserted, first child upsert fails (:162) -> parent with zero children; /app/force lists it as "0 seats" / "0 strokes" (force/page.tsx:58,67) and /app/cox/[id] shows "0 seats".
  - crew parent inserted, seat k of N fails -> parent with k children; the coach re-uploads and gets a *second* parent (CODE-004).
  - session upserted with `stroke_count = strokes.length` (:152), then strokes deleted (:166), then a stroke batch fails (:184-185) -> a session row claiming N strokes with 0..N-500 strokes in the table; /app/force shows the claimed count, the history chart and session_stats show the real one.
  - `strokes.delete` fails silently (:166 result ignored) then insert hits PK (session_id, rec) -> 23505 surfaced as "The strokes couldn't be saved: duplicate key..." with stroke_count already updated.
  - strokes saved, storage upload fails (:201) -> session with no files; force/[id] shows "The node didn't keep a curve for this stroke" for every stroke (curve-canvas.tsx:153-156) because `curvesUrl` is null.
  - storage upload succeeds, `session_files.upsert` fails (:202, ignored; also see CODE-010) -> file in the bucket with no row; deleteSession can never find it (it deletes by session_files.path, :214-216) -> permanent storage orphan.
  - one of four files uploads, the next fails -> mixed state; re-upload uses `upsert: true` so it heals, but only if the coach retries.
  The user sees a red message for the failure at hand; nothing tells them the outing is half-saved, and nothing cleans up.
- Evidence: line numbers above; no `rpc`/transaction wrapper anywhere in app/ or lib/ (`grep -rn "rpc(" app lib` finds only `is_beta_user`).
- Suggested fix: Move the DB part into one Postgres function (`rpc('ingest_session', jsonb)`) that inserts parent, children, strokes and session_files atomically; do storage uploads first, and on DB failure delete what was uploaded. At minimum, wrap the tail in a compensating cleanup (delete the parent/child rows created in this call on any error).
- Effort: L

### CODE-004 Re-uploading a multi-seat outing creates a second crew parent and orphans the first (crew rows have no idempotency key)
- Severity: High
- Status: CONFIRMED (by reading)
- Location: app/app/(dash)/force/actions.ts:113-129, :137-158; supabase/migrations/20260922180943_session_model.sql:86-89
- What's wrong and why it matters: Seat sessions are idempotent via (team_id, device_id, session_uuid). Crew parents (`kind: "crew"`) are plain inserts with no device_id/session_uuid, so they are never de-duplicated. On a re-upload of the same zip, a new parent is inserted (:116), then each child upserts onto its existing row with `parent_id: parentId` (the new one). The old parent now has zero children and stays in /app/force ("0 seats", "0 strokes") and /app/cox forever. Since re-upload is the documented recovery path for CODE-003 ("Re-uploading the same session replaces its strokes", :165), this is the normal outcome of a retry.
- Evidence: actions.ts:116-127 inserts `{ kind: "crew", ... }` with no device/uuid; :140 `parent_id: parentId`; migration :87-89 unique index only covers rows with device_id/session_uuid.
- Suggested fix: Derive a stable crew key (e.g. sorted child session_uuids hashed, or `(team_id, recorded_at, boat_id, kind='crew')`) and upsert the parent on it; or, before inserting, look up the existing parent of any child that already exists and reuse it. Add a cleanup for parents with no children.
- Effort: M

### CODE-005 No error boundaries, no not-found page, and every page-level Supabase error is swallowed: outages render as "Nothing here yet" or a bare 404
- Severity: High
- Status: CONFIRMED
- Location: app/ (no error.tsx, global-error.tsx, not-found.tsx, loading.tsx — verified with `find app -name ...`); app/app/(dash)/force/page.tsx:24-36; app/app/(dash)/cox/page.tsx:18-24; app/app/(dash)/force/[id]/page.tsx:34-39; app/app/(dash)/cox/[id]/page.tsx:26-31; app/app/(dash)/cox/compare/page.tsx:15-33, :70-76; lib/supabase/server.ts:41-48
- What's wrong and why it matters: Every read is `const { data } = await sb.from(...)`; `error` is destructured nowhere in app/app/(dash)/**. Consequences per page when Supabase is down, RLS misconfigured, or a query is wrong:
  - /app/force: `data` null -> `sessions = []` -> "Nothing here yet. Upload a session from a node and it lands here." (force/page.tsx:51-53). The coach thinks their data is gone.
  - /app/cox: "No crew outings yet." (cox/page.tsx:38-40).
  - /app/force/[id], /app/cox/[id]: `maybeSingle()` returns null on error -> `notFound()` -> Next's default unstyled 404 (there is no not-found.tsx, so it is the framework page, outside the dashboard shell).
  - /app/cox/compare: both pieces null -> "Nothing picked" and a table of "—".
  - getViewer(): `sb.rpc("is_beta_user")` error -> `ok` undefined -> `state: "not-allowed"` -> a beta user sees "The dashboard is for beta crews... isn't on the beta list yet" (request-access.tsx:14-17) during any RPC failure. `sb.auth.getUser()` error -> "signed-out" -> redirect to /app/login.
  A thrown error (e.g. env var missing -> lib/supabase/server.ts:8 throws) renders Next's generic "Application error" page with no branding and no recovery link. Monitoring: the only telemetry is five `console.error` calls (force/actions.ts:96, login/actions.ts:29,42, beta/actions.ts:103,107). Vercel captures those in function logs (retention per plan), and that is the sum of observability: no Sentry/OpenTelemetry, no `instrumentation.ts`, no health-check route, no alerting. Vercel Analytics/Speed Insights are loaded (app/layout.tsx:65-66) but are traffic/perf, not errors.
- Evidence: `find app -name "error.tsx" -o -name "global-error.tsx" -o -name "not-found.tsx" -o -name "loading.tsx"` -> nothing; the build manifest shows only the framework's `/_global-error` and `/_not-found` (.next/app-path-routes-manifest.json).
- Suggested fix: Add app/error.tsx and app/app/(dash)/error.tsx (with a retry button), app/not-found.tsx, and app/global-error.tsx; check `error` on every query and throw so the boundary shows it; add app/api/health/route.ts that pings Supabase; add Sentry (or at least `instrumentation.ts` + `onRequestError`) so console.error is not the only trace.
- Effort: M

### CODE-006 `setSeatSide` silently does nothing for outings uploaded without a boat name; the UI shows the side as saved, and it is gone on reload
- Severity: High
- Status: CONFIRMED (by reading)
- Location: app/app/(dash)/cox/actions.ts:7-15; app/app/(dash)/cox/[id]/crew-view.tsx:55-57; components/dash/crew-panel.tsx:32-34, :140-143; app/app/(dash)/force/upload-form.tsx:75-80 ("Boat (optional)")
- What's wrong and why it matters: Sides live on `seats (boat_id, seat_number)`. `setSeatSide` looks the child session up and returns early `if (!session?.boat_id || session.seat_number === null)` (actions.ts:10). The upload form marks the boat as optional, so the default outing has `boat_id = null` and every P/S click is a silent no-op. Meanwhile crew-panel.tsx:141 updates local state first (`setSides(...)`) and crew-view.tsx:56 fires the action with `void setSeatSide(...)` — no await, no error return, no toast — so the button lights up, "Port and starboard" balance appears, and on the next reload everything is unset again. The `seats.upsert` result (actions.ts:11-13) is also discarded, so a real DB/RLS error looks identical. `revalidatePath("/app/cox")` (actions.ts:14) revalidates only the /app/cox page (no `type: "layout"`), not /app/cox/[id] where the user is; per node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md ("Pages: Invalidates the specific page"), that is a page-only invalidation. Because the local state masks it, the symptom is "it saved, then it forgot" rather than "it never shows".
- Evidence: actions.ts:10 `if (!session?.boat_id || session.seat_number === null) return;`; crew-view.tsx:56 `void setSeatSide(seatId, side);`; crew-panel.tsx:141-142 `setSides((v) => ({ ...v, [s.id]: side })); onSetSide?.(s.id, side);`
- Suggested fix: Make the action return `{ ok, message }`, await it in CrewView with `useTransition`, roll back local state and show the message on failure; either require a boat for crew uploads or store sides on the child session when there is no boat; revalidate `/app/cox/[id]` (or use `type: "layout"`).
- Effort: S

---

#### Medium

### CODE-007 The only upload E2E test can never sign in: it writes localStorage "sb-auth", which @supabase/ssr never reads
- Severity: Medium
- Status: CONFIRMED (by reading)
- Location: tests/app.spec.ts:30-44; lib/supabase/server.ts:18-33; proxy.ts:13-22
- What's wrong and why it matters: The signed-in test posts to `/auth/v1/token?grant_type=password`, then `localStorage.setItem("sb-auth", JSON.stringify({access_token, refresh_token}))` and navigates to /app/force. The server client reads the session from the `sb-<ref>-auth-token` cookies only (`cookies.getAll` in server.ts:23 and proxy.ts:15); nothing on the server or client reads localStorage. So even with TEST_USER_EMAIL/PASSWORD set, `page.goto("/app/force")` redirects to /app/login and the test fails at `getByLabel("Files")`. The upload path — the riskiest code in the repo (CODE-001/003/004) — therefore has zero automated coverage, and the test that appears to cover it is dead.
- Evidence: app.spec.ts:39-42 `localStorage.setItem("sb-auth", ...)`; no occurrence of `localStorage` or `sb-auth` anywhere in app/ or lib/.
- Suggested fix: Set the auth cookies instead (`context.addCookies` with the chunked `sb-<project-ref>-auth-token` value the ssr package expects), or drive the magic-link flow against a test project with the email hook disabled; then run the test in CI.
- Effort: S

### CODE-008 `teamId()` select-then-insert has no uniqueness guard; concurrent first uploads create two teams and later uploads land in whichever `limit(1)` returns
- Severity: Medium
- Status: SUSPECTED (race; confirmed possible by schema)
- Location: app/app/(dash)/force/actions.ts:15-29; supabase/migrations/20260922180943_session_model.sql:21-28
- What's wrong and why it matters: `team_members` PK is (team_id, user_id) — a user can be in any number of teams and nothing says "one team per user". Two overlapping first uploads (double-click before `pending` disables the button, two tabs, a retry after a slow response) each see no membership and each create a team. From then on `.select("team_id").limit(1).maybeSingle()` with no ORDER BY returns an arbitrary membership, so sessions, boats and storage folders split across two teams, and RLS (which is team-scoped) will show/hide different halves of the coach's data depending on which team the query picked. Also: `uploadSession` calls `getViewer()` (2 round trips) and `teamId()` calls it again (:16), so every upload does 4 auth/RPC calls before any work.
- Evidence: actions.ts:20 `.select("team_id").limit(1).maybeSingle()`; :24 unconditional `teams.insert`.
- Suggested fix: Add `create unique index team_members_one_team_per_user on team_members(user_id)` (or a `profiles.team_id`), and catch 23505 to re-select; order the select deterministically. Pass the viewer into teamId().
- Effort: S

### CODE-009 `deleteSession` is dead code that is still a publicly callable server action, and it deletes storage before the DB row and ignores every error
- Severity: Medium
- Status: CONFIRMED
- Location: app/app/(dash)/force/actions.ts:209-219
- What's wrong and why it matters: No component imports `deleteSession` (grep across app/, components/, lib/ finds only the definition; knip lists it as an unused export). It is nevertheless exported from a `"use server"` module, so it is a reachable endpoint for any signed-in user with a session id (RLS scopes it to their team, so not a cross-tenant issue). Order of operations: storage `remove` (:216) before `sessions.delete` (:218); if the delete fails the files are gone and the row remains, and force/[id] then reports "The node didn't keep a curve" for every stroke. Results of `.remove()` and `.delete()` are both discarded; `revalidatePath` runs regardless. There is no UI to delete an outing, so a coach who uploads the wrong file has no way to remove it (and per CODE-004 orphans accumulate).
- Evidence: actions.ts:216 `if (files?.length) await sb.storage.from("sessions").remove(...)`; :218 `await sb.from("sessions").delete().eq("id", id);`
- Suggested fix: Either wire a delete button (with confirm) or remove the export until then; delete the DB row first (cascades to session_files/strokes), then remove storage objects, and return errors.
- Effort: S

### CODE-010 `session_files.upsert` fails silently on every re-upload: the table has no UPDATE policy, and the result is discarded
- Severity: Medium
- Status: CONFIRMED (by schema + code). **[Lead note]** Live `pg_policies` shows exactly three policies on `session_files` (`members read`, `members write`, `members delete`), no UPDATE policy.
- Location: app/app/(dash)/force/actions.ts:202; supabase/migrations/20260922180943_session_model.sql:153-155
- What's wrong and why it matters: `session_files` has "members read" (select), "members write" (insert) and "members delete" policies but no `for update` policy. `upsert(..., { onConflict: "session_id,kind" })` becomes `INSERT ... ON CONFLICT DO UPDATE`; on the conflict path Postgres applies UPDATE RLS, and with no UPDATE policy the default is deny, so the statement errors (42501). The code does `await sb.from("session_files").upsert(...)` with no destructuring, so the error is never seen. Effect today is small (the path is deterministic so the row stays correct; only `bytes` goes stale) but it is a second silent-failure pattern in the ingest path and would bite as soon as the path format changes. Same pattern, different table: `seats.upsert` (cox/actions.ts:11) does have an update policy and works, but its result is also ignored.
- Evidence: migration :153-155 (three policies, none `for update`); actions.ts:202 no `{ error }`.
- Suggested fix: Add `create policy "members update" on public.session_files for update ...` and check the upsert result.
- Effort: S

### CODE-011 CurveCanvas draws one grid line + label per 20 units up to the peak; uncalibrated sessions ("counts") can push that to tens of thousands of draw calls per frame
- Severity: Medium
- Status: SUSPECTED (depends on raw HX711 count magnitude; every real node today is uncalibrated per app/page.tsx:104 and lib/specs.ts:9)
- Location: components/dash/curve-canvas.tsx:48-69
- What's wrong and why it matters: `top = Math.max(1, ...peaks) * 1.12; step = top > 40 ? 20 : ...; for (let v = 0; v <= top; v += step) { ...stroke(); fillText(String(v)) }`. With `units: "kg"` peaks are ~60 and the loop runs 4 times. With `units: "counts"` (lib/session/format.ts:66 "kg when calibrated, else raw counts"; the 24-bit HX711 produces values in the 10^4–10^6 range after tare) the loop runs `top/20` times: 5,000–50,000 beginPath/stroke/fillText calls on every draw, and the draw is re-run on every ResizeObserver callback and every `layers` change (each stroke selection). Labels like "480000" also overflow the 52 px left pad (PAD.l). Expect a visibly sluggish or frozen session page for the first real uploads. history-panel.tsx and stroke-timeline.tsx use fixed tick counts and are fine.
- Evidence: curve-canvas.tsx:60-68.
- Suggested fix: Pick the step from a nice-number scale targeting ~5 ticks (e.g. `step = niceStep(top / 5)`), and size PAD.l from the widest label.
- Effort: S

### CODE-012 Type safety holes: six `as unknown as` casts over Supabase results, no generated DB types, hand-written Row types drifting per page
- Severity: Medium
- Status: CONFIRMED
- Location: app/app/(dash)/cox/compare/page.tsx:51, :76; app/app/(dash)/cox/page.tsx:24; app/app/(dash)/cox/[id]/page.tsx:73; app/app/(dash)/force/page.tsx:29; app/app/(dash)/force/[id]/page.tsx:66; also `as HistoryPoint[]` force/page.tsx:36, `as DbStroke[]` force/[id]/page.tsx:61 and cox/[id]/page.tsx:54, `(crew.clock_sync_ms as number | null)` cox/[id]/page.tsx:93, `p.t_ms as number` etc. cox/[id]/page.tsx:66-70 and compare/page.tsx:41-45
- What's wrong and why it matters: `supabaseServer()` returns an untyped client (no `Database` generic; there is no `supabase gen types` output in the repo), so every `.select()` returns loosely typed rows and the pages cast them into locally declared shapes (`Row`, `SessionRow`, `Crew`, `DbStroke`, `HistoryPoint`). The casts are unchecked: a renamed column, a changed `boats(name)` embed shape (object vs array), or a nullable column silently becomes a runtime `undefined` rather than a compile error. `as unknown as` specifically exists to defeat the checker. `tsc --noEmit` passing therefore says little about the data layer.
- Evidence: grep output in appendix.
- Suggested fix: Run `supabase gen types typescript --project-id ... > lib/supabase/types.ts` (or the MCP `generate_typescript_types`), pass `Database` to `createServerClient<Database>`, delete the hand-written row types, and check `error` (CODE-005).
- Effort: M

### CODE-013 Non-null assertions and other checker overrides
- Severity: Medium
- Status: CONFIRMED
- Location: app/beta/actions.ts:75-77 (`values.name!`, `values.email!`, `values.organization!`); app/app/(dash)/force/actions.ts:155 (`raw.meta!`); app/beta/signup-form.tsx:72 (`a[k]!`); components/site/attribution.tsx:22 (`q.get("ref")!`); components/site/curve-explorer-view.tsx:59, :82, :254 (`METRICS.find(...)!`), :90, :91, :260 (`on.setActive!`); lib/stroke.ts:50 (`stack.pop()!`); tests/app.spec.ts:32 (`key!`); tests/node.spec.ts:39-42 (`session.curves!`, `curve!`)
- What's wrong and why it matters: Eleven `!` assertions in app code. Most are provably safe today (beta/actions.ts checks emptiness first; raw.meta was tested at :57) but they are the places a refactor breaks silently. No `as any`, `@ts-ignore`, `@ts-expect-error` or `eslint-disable` in the repo (good). `type Json` in lib/session/parse.ts:19 is a sound recursive type; `isObject` narrows correctly.
- Evidence: grep in appendix.
- Suggested fix: Narrow with the values already computed (e.g. build `Application` from a validated object) instead of asserting.
- Effort: S

### CODE-014 Hand-applied migrations, missing first migration, no CI, no seed, no config.toml, no backup beyond the plan default, no `engines`
- Severity: Medium
- Status: CONFIRMED (repo). **[Lead note]** Live `list_migrations` shows six applied migrations: `20260913224311 create_beta_signups` plus the five in the repo, so the first migration exists only in the database. Vercel project Node version is 24.x (matches local). Supabase plan/backups still NEEDS MANUAL CHECK.
- Location: supabase/ (only `migrations/`, five files 20260922174849...20260922183932); README.md:37-52; package.json (no `engines`); no .github/, no vercel.json, no .nvmrc
- What's wrong and why it matters:
  - The first migration `20260913224311_create_beta_signups` is referenced (20260922174849_extend_beta_signups.sql:2) but not in the repo; `beta_signups` cannot be recreated from source. `supabase/config.toml` is absent, so `supabase db reset`/local dev is not possible; there is no seed.
  - Migrations are applied by hand (README.md:39-41 "Applied to the rowtech project"); nothing verifies the live schema matches the files (relevant to CODE-001).
  - No CI: `.github/` does not exist, so lint/tsc/Playwright run only when someone remembers; `package-lock.json` is never checked with `npm ci`; `npm ls` reports five `extraneous` packages (@emnapi/*, @napi-rs/wasm-runtime, @tybys/wasm-util), i.e. node_modules and the lockfile already disagree locally.
  - No `engines` field and no .nvmrc; local Node is v24.14.0 (`node --version`), `@types/node` is `^20`, and Vercel's build/runtime default is whatever the project setting says (NEEDS MANUAL CHECK; likely 22.x). Behaviour differences (e.g. `File`/`Blob`, `TextDecoder`) between 20/22/24 are untested.
  - Backups: nothing in the repo; Supabase free plan has no PITR and daily backups only on Pro (NEEDS MANUAL CHECK of the plan). `allowed_users` is "Managed by hand" (migration 20260922180222:9). `.env.local` is the only local copy of env (README.md:16) — fine, but there is no documented recovery beyond the Vercel dashboard.
  - Single region (Vercel default function region unless configured) + single Supabase region: expected for a beta, noted as SPOF.
- Evidence: `ls supabase` -> `migrations`; `ls -la .github` -> not found; `grep -c "engines" package.json` -> 0; `npm ls --depth=0` output in appendix.
- Suggested fix: Commit the missing migration (dump it from the live DB), add `supabase/config.toml` + a seed, add a GitHub Actions workflow running `npm ci && npm run lint && npx tsc --noEmit && npx playwright test`, pin `engines.node`, and enable Supabase backups/PITR appropriate to the plan.
- Effort: M

### CODE-015 Test coverage: marketing, beta dry-run, login redirect and the pure parser are covered; upload, RLS, auth callback success, delete, cox pages, compare, history chart are not
- Severity: Medium
- Status: CONFIRMED
- Location: tests/app.spec.ts, tests/beta.spec.ts, tests/marketing.spec.ts, tests/node.spec.ts; playwright.config.ts
- What's wrong and why it matters: Covered: `/` structure and CTAs, /force and /vieve 3D canvases, reduced motion, /team 404, beta form happy path + validation (BETA_DRY_RUN=1), /app/force -> /app/login redirect, /auth/callback without code -> error, parse/collect/summarise/toCsv on public/demo. Not covered: any signed-in page, uploadSession (CODE-007), the crew grouping in the DB, cox/[id], compare, setSeatSide, deleteSession, RLS (no SQL tests), exchangeCodeForSession success, history-panel, session-viewer curve fetch, error states. Every finding in the High section is in untested code. `retries: 0` locally, `reporter: list`; `reuseExistingServer: !CI` means a stale dev server on :3210 would be tested instead of the fresh build. The "Resource loading failures detected during page navigation" note from the previous session did not reproduce: the list output has no such line and test-results/ contains only `.last-run.json` (`{"status":"passed","failedTests":[]}`).
- Evidence: appendix (Playwright output).
- Suggested fix: Fix CODE-007, add a seeded test project, and add a SQL-level RLS test (pgTAP or a script) for team isolation.
- Effort: M

### CODE-016 Dead code and unused dependencies (knip + manual)
- Severity: Medium
- Status: CONFIRMED (knip via `npx --yes knip --no-progress --reporter compact`, exit 1)
- Location: see list
- What's wrong and why it matters:
  - Unused files: `components/ui/button.tsx` (nothing imports `@/components/ui/button`), `lib/stroke-detector.ts` (the "live detector" port; README.md:32 still advertises it).
  - Unused dependencies: `@base-ui/react`, `class-variance-authority` — both imported only by the unused button.tsx. `shadcn` (the CLI, ^4.2.0) is a *production* dependency used only for `@import "shadcn/tailwind.css"` in app/globals.css:3; it drags in @modelcontextprotocol/sdk, hono, express etc. (the source of most `npm audit` highs per the audit brief). `tw-animate-css` is used (globals.css:2). `server-only` is used (lib/supabase/server.ts:1). `posthog-js` is used via dynamic import (lib/analytics.ts:21).
  - Unused exports: `deleteSession` (force/actions.ts:210), `NEXT_STEPS` (signup-form.tsx:20), `CREW`/`CrewCard` (vieve-screen.tsx:17,20), `CV`,`T0`,`T1`,`area` (curve-explorer-model.ts), `PY0`,`KG0`,`KG1`,`kgAtY` (stroke-frame.ts), `boatAt` (river.ts:78), `FILE_NAMES`/`FileName` (format.ts:25-26), `parseEvents`,`checkCurves` (parse.ts — used internally only), `parseVieveSession`,`GpsPoint`,`VieveSession` (vieve.ts:25-68 — a stub that only throws), `hash01`,`forceAt`,`SPS`,`PULSE_S` (stroke.ts).
  - `lib/river.ts` is used (components/device/vieve-screen.tsx:3) — not dead.
  - Previously removed components are really gone: photo-slot.tsx (60aca2a), annotated-diagram.tsx (90aa943), screen-tour-view.tsx (9f0d6b9) are absent from `git ls-files` and nothing imports them. `scope-strip.tsx` exists and is imported by hero.tsx.
  - components.json:20 aliases `hooks` to `@/hooks`, a directory that does not exist.
  - scripts/make-demo-session.mjs writes public/demo/seat-{1..8}/{meta.json,strokes.csv,curves.bin,events.csv} (300 KB, committed, shipped to production under /demo/*). It is used by tests/node.spec.ts:10 and tests/app.spec.ts:46-49 only; no app code references /demo. It duplicates `driveShape`/`hash01`/`measure` from lib/stroke.ts because .mjs cannot import the TS.
- Evidence: knip output in appendix; greps in appendix.
- Suggested fix: Delete button.tsx + the two deps; move `shadcn` to devDependencies (Tailwind resolves the import at build time) or inline the CSS it provides; delete or wire stroke-detector.ts; drop the unused exports; fix/remove the `hooks` alias.
- Effort: S

---

#### Low

### CODE-017 Duplicated code across the dashboard
- Severity: Low
- Status: CONFIRMED
- Location: `DbStroke` + `toStroke`: app/app/(dash)/force/[id]/page.tsx:10-28 and app/app/(dash)/cox/[id]/page.tsx:10-20 (identical). `TrackPoint` mapping from gps_points: cox/[id]/page.tsx:65-71 and cox/compare/page.tsx:40-46 (identical). Split formatting: cox/compare/page.tsx:65 `split()` and components/dash/piece-map.tsx:19 `fmtSplit()` (identical bodies); split-from-speed: compare/page.tsx:48 and piece-map.tsx:18. Input class strings: app/beta/signup-form.tsx:13-14, app/app/login/login-form.tsx:64, app/app/(dash)/force/upload-form.tsx:11-12, cox/compare/compare-picker.tsx:30, components/dash/session-viewer.tsx:133 (five near-identical `block w-full rounded-md border border-input bg-[#0b0e11] ...` strings). Chip/button class: session-viewer.tsx:22-23, history-panel.tsx:127, piece-map.tsx:157 (identical). Row types: `Row` (cox/page.tsx:7), `SessionRow` (force/page.tsx:9), `Crew` (compare/page.tsx:10) all partial views of `sessions`. `hash01`/`driveShape`/`measure` duplicated between lib/stroke.ts and scripts/make-demo-session.mjs. Marketing: `const wrap = "mx-auto w-full max-w-7xl px-5 sm:px-8"` repeated in app/page.tsx:17, app/force/page.tsx:18, app/vieve/page.tsx:19.
- What's wrong and why it matters: Two copies of the stroke mapping is exactly where a column rename will be fixed once. The class strings are the design system that shadcn's Button was meant to be (CODE-016).
- Suggested fix: `lib/db/rows.ts` (toStroke, toTrackPoint, generated types), `lib/session/format.ts` gets `fmtSplit`, a `components/ui/field.tsx` for inputs.
- Effort: S

### CODE-018 Seat 0 is "cox" in the schema, "never set" in the parser, and "seat ?" / `-1` in the pages
- Severity: Low
- Status: CONFIRMED
- Location: supabase/migrations/20260922180943_session_model.sql:55 (`seat_number smallint ... -- 0 = cox`); lib/session/format.ts:42-43 ("Seat the node was on. 0 when it was never set."); app/app/(dash)/cox/[id]/page.tsx:47 (`.eq("seat_number", k.seat_number ?? -1)`), :52 (`k.seat_number ? "seat N" : "seat ?"`); app/app/(dash)/force/[id]/page.tsx:59 (same); force/page.tsx:67 (`Seat ${s.seat_number ?? "?"}` — treats 0 as "Seat 0", inconsistent with the other two)
- What's wrong and why it matters: A node whose seat was never set writes `seat: 0`; it is stored as 0 (passes the 0..8 check), labelled "seat ?" on two pages and "Seat 0" on the list, and its side lookup hits `seats.seat_number = 0` which the schema documents as the cox. `?? -1` never matches anything (check constraint 0..8) — harmless but a smell that hides the null case instead of handling it. A crew with two unset nodes gets two children with seat 0 and the history chart (`seat_number !== null`, force/page.tsx:36) plots them as one series.
- Suggested fix: Decide one meaning (reject seat 0 at upload with a clear message, or store null), and label consistently.
- Effort: S

### CODE-019 Signed curve URLs expire after 1 h; a failed fetch is reported as "The node didn't keep a curve", and there is no retry
- Severity: Low
- Status: CONFIRMED (by reading)
- Location: app/app/(dash)/force/[id]/page.tsx:55 (`createSignedUrl(file.path, 3600)`); components/dash/session-viewer.tsx:37-47; components/dash/curve-canvas.tsx:153-156
- What's wrong and why it matters: `curves.bin` for a seat is fetched lazily when the seat (or overlay) is first selected. If the tab has been open > 1 h the signed URL is 400/403; the `.catch(() => setCurves(... null))` maps that to "The node didn't keep a curve for this stroke." (a statement about the data, not the network). `pending` (a ref) is never cleared, so the seat is never retried until reload. Same message for a genuine network failure.
- Suggested fix: Distinguish `null` (no file) from `"error"`, show "Couldn't load the curve — reload", and clear `pending` on failure; or fetch via a route handler that signs on demand.
- Effort: S

### CODE-020 Loose multi-file upload cannot represent several seats; the form copy overstates it
- Severity: Low
- Status: CONFIRMED (by reading)
- Location: lib/session/collect.ts:22-33 (`dir = parts.join("/") || "session"`); app/app/(dash)/force/upload-form.tsx:43-47, :58-66
- What's wrong and why it matters: A plain `<input type="file" multiple>` yields basenames only, so any loose files all land in the one "session" folder and the last `meta.json` wins (collect.ts:31 overwrites). The form says "Pick several seats at once and they become one outing" but that only works with a zip that keeps folders (as the tests do, tests/node.spec.ts:86-97). A coach who selects files from two seat folders in two goes (the picker replaces the selection) or copies eight sets into one folder can't get there; the failure is either one seat silently or a curves/strokes mismatch error. No `webkitdirectory` option is offered.
- Suggested fix: Say "several seats as one zip", or add a folder picker (`webkitdirectory`) and use `webkitRelativePath` in `collect`.
- Effort: S

### CODE-021 Latent infinite loop in CrewPanel when a synced crew has no seats
- Severity: Low
- Status: SUSPECTED (unreachable today: nothing writes `clock_source = 'gps'`)
- Location: components/dash/crew-panel.tsx:63-75
- What's wrong and why it matters: `const n = Math.min(...seats.map((s) => s.strokes.length)); if (!n) return null; for (let i = 0; i < n; i++) ...`. With `seats = []`, `Math.min()` is `Infinity`, `!n` is false, and the loop runs forever with `mean = NaN` — a browser hang. Reachable the day a GPS crew session with zero children exists (see CODE-004 for how empty parents happen).
- Suggested fix: `if (!seats.length) return null;` before the min.
- Effort: S

### CODE-022 History chart: `.limit(500)` ascending drops the newest sessions once a team passes 500 seat-sessions; other silent caps
- Severity: Low
- Status: CONFIRMED (by reading)
- Location: app/app/(dash)/force/page.tsx:31-36 (`order("recorded_at", { ascending: true }).limit(500)`); force/page.tsx:28 `.limit(200)` sessions; cox/page.tsx:23, compare/page.tsx:75 `.limit(100)`; cox/[id]/page.tsx:63 and compare/page.tsx:33 `.limit(20000)` gps points (about 33 min at 10 Hz)
- What's wrong and why it matters: An eight uploads 8 stats rows per outing, so 500 rows is about 62 outings; after that the "Seat by seat, over time" chart silently stops including new sessions because the query keeps the oldest 500. The 200-session list cap also hides older outings with no pagination or notice. A 40-minute piece would lose its last 7 minutes of track.
- Suggested fix: Order descending and take the last N, or aggregate per week in SQL; paginate the list; raise/announce the GPS cap.
- Effort: S

### CODE-023 Raw Postgres error strings are shown to coaches
- Severity: Low
- Status: CONFIRMED
- Location: app/app/(dash)/force/actions.ts:108, :128, :162, :185, :201
- What's wrong and why it matters: `${error.message}` from PostgREST is interpolated straight into the alert, e.g. a meta.json with `seat: 9` produces "The session couldn't be saved: new row for relation "sessions" violates check constraint "sessions_seat_number_check"". Useful for debugging, unfriendly and mildly leaky (table/constraint names).
- Suggested fix: Map known codes (23505, 23514, 42501) to plain-English messages and log the raw one.
- Effort: S

### CODE-024 `signup-form` remounts the whole form on every server response; focus and scroll are lost
- Severity: Low
- Status: CONFIRMED (by reading)
- Location: app/beta/signup-form.tsx:105-107 (`key={state === EMPTY_STATE ? "init" : JSON.stringify(v) + state.message}`)
- What's wrong and why it matters: The `key` changes on each action result so React unmounts and remounts the `<form>`, re-applying `defaultValue`s from the server. That is the intent (restore values), but it also drops focus (the `role="alert"` paragraph is announced, so screen readers cope) and resets native state such as scroll position inside the `<details>`. `open` (useState in the parent) and the `started`/`completed` refs survive because they are outside the keyed subtree. `checkRequired` runs `el.elements.namedItem` on every input event — cheap, fine.
- Suggested fix: Use controlled inputs seeded from `state.values`, or key only on `state.message`.
- Effort: S

### CODE-025 `getViewer()` and `proxy.ts` ignore auth/RPC errors; a Supabase blip masquerades as "not on the beta list"
- Severity: Low
- Status: CONFIRMED (by reading)
- Location: lib/supabase/server.ts:43-47; proxy.ts:24
- What's wrong and why it matters: `const { data: ok } = await sb.rpc("is_beta_user")` — any error (function missing after a bad migration, network) yields `ok === undefined` -> "not-allowed" -> RequestAccess page, which tells a paying beta user to apply again. `proxy.ts` calls `sb.auth.getUser()` for the refresh side-effect and discards the result — acceptable, per the @supabase/ssr README pattern — but a refresh failure is invisible. Both are fine for the happy path; neither distinguishes "no" from "error".
- Suggested fix: Return a fourth state `"error"` and render an error boundary (CODE-005).
- Effort: S

### CODE-026 `hardware/` (KiCad + `.mcp-backups/`) and an empty `New folder` sit untracked in the web repo
- Severity: Low
- Status: CONFIRMED
- Location: C:\Users\notre\projects\rowtech\hardware\force-carrier-v1\* (10 files, 366 KB incl. two `.mcp-backups/*.kicad_pcb.<timestamp>`); C:\Users\notre\projects\rowtech\New folder (empty, Sep 22)
- What's wrong and why it matters: `git status` has shown `?? hardware/` for at least two sessions. If it is committed as-is, `.mcp-backups` (tool-generated backups) and KiCad files go into the Next.js repo and the Vercel build upload (.vercelignore does not exclude `hardware/`). If it is not meant to be here, it is unversioned work sitting next to a repo. `New folder` is Windows-Explorer residue.
- Suggested fix: Move hardware/ to its own repo (the firmware already lives elsewhere per MEMORY.md) or commit it with `hardware/**/.mcp-backups/` in .gitignore and `hardware/` in .vercelignore; delete `New folder`.
- Effort: S

### CODE-027 `history-panel` pad maths inverts the axis for an all-negative, all-equal series
- Severity: Low
- Status: CONFIRMED (edge case)
- Location: app/app/(dash)/force/history-panel.tsx:60-62; same pattern components/dash/stroke-timeline.tsx:54-57
- What's wrong and why it matters: `padV = (hi - lo || hi || 1) * 0.2`. If every value is the same negative number (possible for `avg_rise_rate` on a noisy uncalibrated node) `padV` is negative, `top < bottom`, and `Y()` divides by a negative span: the point plots off-canvas. `bottom = Math.max(0, lo - padV)` also clamps negative data to 0. Not reachable with kg data.
- Suggested fix: `Math.abs(hi - lo) || Math.abs(hi) || 1`, and drop the `Math.max(0, ...)` when `lo < 0`.
- Effort: S

### CODE-028 PieceMap: degenerate bounds, O(n) hover over 20 k points, unscaled degree distance
- Severity: Low
- Status: SUSPECTED (no GPS data exists yet)
- Location: components/dash/piece-map.tsx:98-106, :110-121, :114
- What's wrong and why it matters: `fitBounds` with all-identical points (boat stationary) gives a zero-area box; MapLibre clamps to maxZoom rather than throwing, so it "works" but shows nothing useful. Hover walks all points per mousemove (fine to ~20 k, but the query cap is 20 k). Distance uses `(dlon)^2 + (dlat)^2` without `cos(lat)` scaling — nearest-point is wrong by up to ~2x at 45N. The CSS `await import("maplibre-gl/dist/maplibre-gl.css")` inside an effect works with Next but yields a flash of unstyled controls.
- Suggested fix: Guard identical bounds with `setCenter/zoom`, scale longitude by `cos(lat)`, and use a spatial index or the line layer's `queryRenderedFeatures`.
- Effort: S

### CODE-029 N+1 queries and no streaming on the detail pages; three Supabase clients per compare render
- Severity: Low
- Status: CONFIRMED
- Location: app/app/(dash)/force/[id]/page.tsx:48-64 (per seat: strokes, session_files, createSignedUrl = 3 sequential round-trips x N seats); app/app/(dash)/cox/[id]/page.tsx:40-56 (2 x N); app/app/(dash)/cox/compare/page.tsx:12-14 (`piece()` calls `supabaseServer()` per piece + once in the page)
- What's wrong and why it matters: An eight is 24 sequential awaits before the page can stream anything, and there is no `loading.tsx`/Suspense, so the coach sees a blank main area for the whole time. `supabaseServer()` re-reads cookies each call; harmless but wasteful.
- Suggested fix: One `strokes.in("session_id", ids)` query grouped in JS, one `session_files.in(...)`, sign URLs in parallel (`Promise.all`), add `loading.tsx`.
- Effort: S

### CODE-030 `strokes` numeric columns are `real` (float4); CSV export from the DB is not byte-identical to the node's file
- Severity: Low
- Status: CONFIRMED (schema)
- Location: supabase/migrations/20260922180943_session_model.sql:110-116; lib/session/analyse.ts:95-106 (`toCsv` with `%.4f`/`%.5f`); tests/node.spec.ts:52-57
- What's wrong and why it matters: `peak`, `impulse`, `rise_rate`, `third1..3` are stored as float4 (~7 significant digits). `toCsv` re-prints with 4-5 decimals, so values >= 100 (raw counts are >= 10^4) lose digits relative to strokes.csv. The "export gives back the same rows" test round-trips parse -> toCsv only, never through the DB, so it does not catch this. The original files are kept in Storage, so nothing is lost, but the "Export CSV" button (session-viewer.tsx:86-93) is presented as the session's data.
- Suggested fix: Use `double precision`, or have Export CSV download the stored strokes.csv from Storage.
- Effort: S

### CODE-031 `session_stats.span_ms` uses `max(drive_ms)`, not the last stroke's drive
- Severity: Low
- Status: CONFIRMED
- Location: supabase/migrations/20260922181900_session_stats_view.sql:23
- What's wrong and why it matters: `(max(k.catch_ms) + max(k.drive_ms) - min(k.catch_ms))` overstates the span by (longest drive - last drive), typically tens of ms. lib/session/analyse.ts:48 computes it correctly client-side (`last.catchMs + last.driveMs - first.catchMs`), so the two "Time" figures (compare page vs session page) can differ.
- Suggested fix: `max(catch_ms + drive_ms) - min(catch_ms)`.
- Effort: S

### CODE-032 `uploadSession` revalidates only /app/force although it also creates crew rows shown on /app/cox
- Severity: Low
- Status: CONFIRMED (by reading; practically harmless because both pages are dynamic)
- Location: app/app/(dash)/force/actions.ts:205, :218
- What's wrong and why it matters: `revalidatePath("/app/force")` after creating a crew session; /app/cox and /app/cox/compare are not revalidated. Because every dashboard page reads cookies it is dynamic and never cached on the server, and Next 16's client router cache uses `staleTimes.dynamic = 0` by default, so in practice nothing is stale — the call is a no-op either way. Worth fixing only for correctness/intent.
- Suggested fix: `revalidatePath("/app", "layout")`.
- Effort: S

---

#### Info

### CODE-033 `proxy.ts` follows the Next 16 convention and the @supabase/ssr pattern (OK)
- Severity: Info
- Status: CONFIRMED
- Location: proxy.ts:7-30; node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:11, :64-66; node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md:625-648
- What's wrong and why it matters: Nothing wrong. The docs state "The `middleware` file convention is deprecated and has been renamed to `proxy`" and "The file must export a single function, either as a default export or named `proxy`"; proxy runs on the Node.js runtime and `runtime` cannot be configured. proxy.ts uses the named export and the matcher `["/app/:path*", "/auth/:path*"]`. The cookie dance (set on `request.cookies`, rebuild `NextResponse.next({ request })`, copy to `response.cookies`) is the Supabase-documented Next pattern; the ssr 0.12.7 README in node_modules only shows the React Router variant but the semantics match. `getUser()` is called immediately after client creation with nothing in between, as Supabase advises. Note: if `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` are unset the proxy passes the request through silently (:11) and the layout then throws (server.ts:8).
- Suggested fix: none.
- Effort: n/a

### CODE-034 `experimental.serverActions.bodySizeLimit: "25mb"` and `images.qualities: [75]` are correct for Next 16
- Severity: Info
- Status: CONFIRMED
- Location: next.config.ts:4-11; node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md:24-40; .../02-components/image.md:698-728
- What's wrong and why it matters: `bodySizeLimit` is documented under `experimental.serverActions` (default 1 MB) and accepts "25mb"; `images.qualities` "is required starting with Next.js 16" and `[75]` is the documented default. A 25 MB body is buffered entirely in the function (`entry.arrayBuffer()` actions.ts:35, then `unzipSync` in collect.ts:41), which is a memory/zip-bomb consideration for the security audit rather than a config error. No `headers()` in next.config.ts (security audit).
- Suggested fix: none here.
- Effort: n/a

### CODE-035 `next-env.d.ts` and `*.tsbuildinfo` are git-ignored, matching the Next 16 docs
- Severity: Info
- Status: CONFIRMED
- Location: .gitignore:41-42; node_modules/next/dist/docs/01-app/03-api-reference/05-config/02-typescript.md:89-92 ("We recommend adding `next-env.d.ts` to your `.gitignore` file"); `git ls-files` contains neither
- Suggested fix: none.
- Effort: n/a

### CODE-036 Stroke maths reviewed for divide-by-zero / NaN: no defects found
- Severity: Info
- Status: CONFIRMED
- Location: lib/session/analyse.ts:5-13 (`mean` guards empty, `cv` guards n<3 and m=0), :31-35 (`rateAt` guards `i <= 0 || i >= length` and `dt > 0`), :61-65 (`thirdsPct` guards total 0), :74 (ratio guards driveMs 0), :84-87 (`fmt` returns a dash for non-finite); lib/stroke-detector.ts:60 (`span = max(...,1e-6)`), :52 (`tb === ta`), :123/:151 (`v !== vp`), :186-188 (n<3, |mean|<1e-9); lib/stroke.ts:55 (`len || 1`), :127 (`throw "no crossing"` — only with the fixed EXAMPLE inputs, never on user data); lib/river.ts:28, :43, :82 (`|| 1`, `d ? ... : 0`); components/dash/crew-panel.tsx:45-46 (`|| 1`, `crew ?`), :77 (`Math.max(..., 1)`); compare/page.tsx:36-38, :53-54 (`Math.max(..., 0)`), :88 (`|| 1`); piece-map.tsx:24 (`|| 1`); curve-canvas.tsx:49, :51 (`Math.max(1, ...)`).
- What's wrong and why it matters: Nothing; listed so the reviewer knows these were checked. `Math.max(...arr)` spreads of up to 20 000 elements (piece-map.tsx:102-103, stroke-timeline.tsx:50-51) are within V8's argument limit.
- Suggested fix: none.
- Effort: n/a

### CODE-037 `upload-form` post-success navigation effect is sound
- Severity: Info
- Status: CONFIRMED
- Location: app/app/(dash)/force/upload-form.tsx:36-38
- What's wrong and why it matters: `useEffect(() => { if (state.status === "ok" && state.sessionId) router.push(...) }, [state, router])`. `useActionState` returns a new state object per completed action, so the effect fires once per successful submit and the component unmounts on navigation; a re-render without a new action does not re-fire. Back-navigation remounts with `EMPTY`. `nowLocal()` (:15-19) correctly produces the local wall-clock for `datetime-local` (the server-side parse is the bug, CODE-002).
- Suggested fix: none.
- Effort: n/a

### CODE-038 Auth is checked in the (dash) layout; per the Next docs, layouts don't re-run on client navigation, and the two mutating server actions do no viewer check
- Severity: Info (security audit owns this; noted for completeness)
- Status: CONFIRMED (by reading)
- Location: app/app/(dash)/layout.tsx:10-12; app/app/(dash)/cox/actions.ts:7; app/app/(dash)/force/actions.ts:210; node_modules/next/dist/docs/01-app/02-guides/authentication.md:1348-1356, :1446-1451
- What's wrong and why it matters: The docs say "be cautious when doing checks in Layouts as these don't re-render on navigation" and "Ensure that any Server Actions called from these components also perform their own authorization checks". Here RLS is the real gate (every table policy uses is_team_member/is_beta_user), so a signed-out or not-allowed caller of `setSeatSide`/`deleteSession` gets empty results rather than data; functionally safe, structurally fragile.
- Suggested fix: Call `getViewer()` at the top of every server action (uploadSession already does).
- Effort: S

### CODE-039 Server Components format dates with the server's locale and zone
- Severity: Info (folded into CODE-002)
- Status: CONFIRMED
- Location: app/app/(dash)/cox/page.tsx:53; force/page.tsx:70; force/[id]/page.tsx:79; cox/[id]/page.tsx:84; compare/page.tsx:102
- What's wrong and why it matters: `new Date(x).toLocaleString()` in a Server Component uses the Vercel function's locale (en-US) and zone (UTC), not the coach's. Today it cancels the storage bug visually; after CODE-002 is fixed it will show UTC to everyone.
- Suggested fix: Format in a small client component or pass `timeZone` from a cookie/header.
- Effort: S

### CODE-040 Lint / type-check / test tooling status
- Severity: Info
- Status: CONFIRMED
- Location: eslint.config.mjs; tsconfig.json; playwright.config.ts
- What's wrong and why it matters: `npm run lint` -> clean (eslint 9 flat config, `eslint-config-next/core-web-vitals` + `/typescript`, default ignores only). `npx tsc --noEmit` -> clean. tsconfig: `strict: true`, `target: ES2017` (fine; Next transpiles), `allowJs: true` but `include` has no `.js/.mjs` so scripts/ is unchecked, `@types/node ^20` vs Node 24 runtime. Playwright: two projects (Desktop Chrome, Pixel 7), node.spec ignored on mobile, `retries` 0 locally, `trace: on-first-retry` (so no traces locally), `webServer` builds fresh (`npm run build && npx next start -p 3210`, timeout 180 s) with `BETA_DRY_RUN=1`. `forbidOnly` only in CI. `test-results/` and `playwright-report/` are ignored.
- Suggested fix: Add `engines`, bump `@types/node` to match, include scripts in tsconfig or convert the script to TS.
- Effort: S

### CODE-041 `lib/site.ts` origin fallback
- Severity: Info
- Status: CONFIRMED
- Location: lib/site.ts:2-6; app/layout.tsx:24; app/app/login/actions.ts:10-16
- What's wrong and why it matters: `siteUrl` = SITE_URL || https://VERCEL_PROJECT_PRODUCTION_URL || http://localhost:3000. On Vercel previews the production URL is used for `metadataBase`/canonical/JSON-LD (intended: canonicals should point at production). Locally without SITE_URL, OG images resolve to localhost (expected). The login `callbackUrl` uses `x-forwarded-host` when SITE_URL is unset — trust-of-headers question for the security audit.
- Suggested fix: none here; set SITE_URL in all Vercel environments.
- Effort: n/a

### CODE-042 `lib/supabase/anon.ts` is not marked `server-only`
- Severity: Info
- Status: CONFIRMED
- Location: lib/supabase/anon.ts:1-10 vs lib/supabase/server.ts:1
- What's wrong and why it matters: It reads non-public env (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`) and is only imported by a "use server" module today; without `import "server-only"` a future client import would fail at runtime (env undefined -> throw) rather than at build.
- Suggested fix: Add `import "server-only";`.
- Effort: S

### CODE-043 Beta submit path error handling is correct; confirmation email is a stub; BETA_DRY_RUN is not guarded in production
- Severity: Info
- Status: CONFIRMED
- Location: app/beta/actions.ts:33-37, :92, :94-115
- What's wrong and why it matters: try/catch around the insert, 23505 treated as success (privacy-preserving), `sendConfirmation` wrapped in its own try/catch so it can never break the submit; `console.error` on both. Fine. The dry-run flag (`BETA_DRY_RUN === "1"`) is read at request time from the env, so a stray value in production would disable persistence silently — README warns "never set it in production" but nothing enforces it.
- Suggested fix: Refuse to start (or log loudly) if `BETA_DRY_RUN` is set and `VERCEL_ENV === "production"`.
- Effort: S

---

#### Appendix A — verbatim tool output (trimmed)

### `npm run lint`
```
> rowtech@0.1.0 lint
> eslint

LINT EXIT: 0
```

### `npx tsc --noEmit`
```
(no output)
TSC EXIT: 0
```

### `npx playwright test --reporter=list` (2026-09-24, Node v24.14.0, fresh `next build` + `next start -p 3210`, BETA_DRY_RUN=1)
```
Running 28 tests using 4 workers

  -   1 [desktop] › tests\app.spec.ts:25:7 › signed in › an uploaded sample session renders in /app/force
  ok  2 [desktop] › tests\app.spec.ts:10:5 › a stale magic link says so instead of failing quietly (6.1s)
  ok  3 [desktop] › tests\app.spec.ts:3:5 › the dashboard is closed to people who aren't signed in (6.3s)
  ok  5 [desktop] › tests\beta.spec.ts:4:5 › the beta form submits and says what happens next (6.9s)
  ok  4 [desktop] › tests\beta.spec.ts:23:5 › the form says what is wrong rather than failing silently (7.1s)
  ok  6 [desktop] › tests\marketing.spec.ts:3:5 › the marketing page renders, with the beta offered in four places (2.9s)
  ok  7 [desktop] › tests\marketing.spec.ts:29:5 › specifications live on the product pages, not the home page (4.9s)
  ok  8 [desktop] › tests\marketing.spec.ts:42:5 › reduced motion leaves the pages in their finished state (4.7s)
  ok 10 [desktop] › tests\marketing.spec.ts:58:5 › there is no team page for now (5.5s)
  ok 11 [desktop] › tests\marketing.spec.ts:65:5 › the diagrams light the part a note describes (4.6s)
  ok 13 [desktop] › tests\node.spec.ts:23:5 › a node session parses into the numbers the firmware wrote (519ms)
  ok  9 [desktop] › tests\marketing.spec.ts:50:5 › the Force page shows the node as a 3D model with its notes around it (9.3s)
  ok 14 [desktop] › tests\node.spec.ts:52:5 › export gives back the same rows (392ms)
  ok 15 [desktop] › tests\node.spec.ts:59:5 › a file that isn't this format is refused, with a reason (330ms)
  ok 16 [desktop] › tests\node.spec.ts:74:5 › an upload groups seats, loose files and zips the same way (426ms)
  -  17 [mobile] › tests\app.spec.ts:25:7 › signed in › an uploaded sample session renders in /app/force
  ok 12 [desktop] › tests\marketing.spec.ts:73:5 › the Vieve page shows it as a 3D model too (6.3s)
  ok 18 [mobile] › tests\app.spec.ts:10:5 › a stale magic link says so instead of failing quietly (4.0s)
  ok 19 [mobile] › tests\beta.spec.ts:4:5 › the beta form submits and says what happens next (6.9s)
  ok 20 [mobile] › tests\app.spec.ts:3:5 › the dashboard is closed to people who aren't signed in (5.9s)
  ok 22 [mobile] › tests\marketing.spec.ts:3:5 › the marketing page renders, with the beta offered in four places (5.6s)
  ok 21 [mobile] › tests\beta.spec.ts:23:5 › the form says what is wrong rather than failing silently (5.8s)
  ok 23 [mobile] › tests\marketing.spec.ts:29:5 › specifications live on the product pages, not the home page (7.1s)
  ok 24 [mobile] › tests\marketing.spec.ts:42:5 › reduced motion leaves the pages in their finished state (6.8s)
  ok 26 [mobile] › tests\marketing.spec.ts:58:5 › there is no team page for now (5.0s)
  ok 27 [mobile] › tests\marketing.spec.ts:65:5 › the diagrams light the part a note describes (2.8s)
  ok 25 [mobile] › tests\marketing.spec.ts:50:5 › the Force page shows the node as a 3D model with its notes around it (9.2s)
  ok 28 [mobile] › tests\marketing.spec.ts:73:5 › the Vieve page shows it as a 3D model too (4.7s)

  2 skipped
  26 passed (3.5m)
PW EXIT: 0
```
test-results/.last-run.json: `{"status": "passed", "failedTests": []}`. No "Resource loading failures" text appeared in the run output, in test-results/, or in README/PERF/PRODUCT.md.

### `npx --yes knip --no-progress --reporter compact` (exit 1 = issues found)
```
Unused files (2)
components/ui/button.tsx
lib/stroke-detector.ts
Unused dependencies (1)
package.json: @base-ui/react, class-variance-authority
Unused exports (10)
app/app/(dash)/force/actions.ts: deleteSession
app/beta/signup-form.tsx: NEXT_STEPS
components/device/vieve-screen.tsx: CREW
components/site/curve-explorer-model.ts: CV, T0, T1, area
components/site/stroke-frame.ts: PY0, KG0, KG1, kgAtY
lib/river.ts: boatAt
lib/session/format.ts: FILE_NAMES
lib/session/parse.ts: parseEvents, checkCurves
lib/session/vieve.ts: parseVieveSession
lib/stroke.ts: hash01, forceAt, SPS, PULSE_S
Unused exported types (3)
components/device/vieve-screen.tsx: CrewCard
lib/session/format.ts: FileName
lib/session/vieve.ts: GpsPoint, VieveSession
```

### `npm ls --depth=0` (filtered)
```
├── @emnapi/core@1.9.2 extraneous
├── @emnapi/runtime@1.9.2 extraneous
├── @emnapi/wasi-threads@1.2.1 extraneous
├── @napi-rs/wasm-runtime@0.2.12 extraneous
├── @tybys/wasm-util@0.10.1 extraneous
```

### Greps
```
as unknown as / as any / @ts- / eslint-disable  (app components lib proxy.ts tests):
app/app/(dash)/cox/compare/page.tsx:51:    session: session as unknown as Crew,
app/app/(dash)/cox/compare/page.tsx:76:  const crews = (data ?? []) as unknown as Crew[];
app/app/(dash)/cox/page.tsx:24:  const crews = (data ?? []) as unknown as Row[];
app/app/(dash)/cox/[id]/page.tsx:73:    const boat = (crew.boats as unknown as { name: string } | null)?.name;
app/app/(dash)/force/page.tsx:29:  const sessions = (data ?? []) as unknown as SessionRow[];
app/app/(dash)/force/[id]/page.tsx:66:  const boat = (session.boats as unknown as { name: string } | null)?.name;
(no `as any`, `@ts-`, or `eslint-disable`)

try/catch and .catch:
app/app/(dash)/force/actions.ts:50  catch (e)   -> "That zip couldn't be opened." / Vieve message
app/app/(dash)/force/actions.ts:69  catch (e)   -> SessionFormatError message / "that session couldn't be read."
app/app/(dash)/force/actions.ts:95  catch (e)   -> console.error + "We couldn't set your team up."
app/beta/actions.ts:102             catch (e)   -> console.error (confirmation email stub)
app/beta/actions.ts:106             catch (e)   -> console.error + user message
components/dash/piece-map.tsx:123   .catch(() => {})            (map load; silent by design, comment says so)
components/dash/session-viewer.tsx:45 .catch(() => setCurves(null)) (see CODE-019)
components/site/attribution.tsx:28, :46  catch {}               (sessionStorage; intentional)
lib/analytics.ts:41                 .catch(() => {})            (posthog load; intentional)
lib/session/parse.ts:53             catch {}  -> rethrow as SessionFormatError
lib/supabase/server.ts:27           catch {}  (cookie set in Server Component; intentional, documented)

console.*:
app/app/(dash)/force/actions.ts:96, app/app/login/actions.ts:29, :42, app/beta/actions.ts:103, :107 (all console.error)

Awaited Supabase calls whose `error` is never read (app/app/(dash)/**, lib/supabase/server.ts):
force/actions.ts:20 (team_members select), :104 (boats select), :166 (strokes delete), :202 (session_files upsert), :213 (sessions select kids), :215 (session_files select), :216 (storage remove), :218 (sessions delete)
cox/actions.ts:9 (sessions select), :11-13 (seats upsert)
force/page.tsx:24-28, :31-35; force/[id]/page.tsx:34-38, :42-44, :49-53, :54, :55 (createSignedUrl)
cox/page.tsx:18-23; cox/[id]/page.tsx:26-30, :33-37, :41-45, :46-48, :58-63
cox/compare/page.tsx:15-20, :23-26, :28-33, :70-75
lib/supabase/server.ts:43 (auth.getUser), :46 (rpc is_beta_user)

Dependency import check (static imports in app/ components/ lib/ proxy.ts tests/ scripts/):
shadcn: app/globals.css:3 (@import "shadcn/tailwind.css") only
server-only: lib/supabase/server.ts:1
class-variance-authority: components/ui/button.tsx:2 only  (button.tsx unused)
@base-ui/react: components/ui/button.tsx:1 only            (button.tsx unused)
tw-animate-css: app/globals.css:2
posthog-js: dynamic import lib/analytics.ts:21
maplibre-gl: components/dash/piece-map.tsx:4 (type) + dynamic :57-58
fflate: lib/session/collect.ts:4, tests/node.spec.ts:4
three / @react-three/*: components/device3d/scene.tsx
```

### Repo hygiene
```
git ls-files: tsconfig.tsbuildinfo — not tracked; next-env.d.ts — not tracked (both in .gitignore:41-42)
git log @{u}..HEAD: (empty)  -> origin/main == aba1b1a
Untracked: hardware/force-carrier-v1/{.mcp-backups/*(2), *.kicad_pcb, *.kicad_prl, *.kicad_pro, *.kicad_sch, *.kicad_sym, force-carrier.pretty/HX711_Module_Green_10pin.kicad_mod, fp-lib-table, sym-lib-table} (366 KB); "New folder" (empty)
Ignored & present: .graphify_*.json, graphify-out/, .impeccable/, .next/, test-results/
supabase/: migrations/ only (no config.toml, no seed.sql); migrations present: 20260922174849, 20260922180222, 20260922180943, 20260922181900, 20260922183932; referenced but missing: 20260913224311_create_beta_signups
.github/: absent. vercel.json, .nvmrc, .node-version: absent. package.json engines/packageManager: absent.
Local toolchain: node v24.14.0, npm 11.9.0; next 16.2.3, @supabase/ssr 0.12.7, supabase-js 2.116.0
components.json aliases.hooks -> "@/hooks" (directory does not exist)
public/demo: 8 seats × 4 files, 300 KB, committed and served
```

### Deleted-in-history components (confirm the earlier cleanup landed)
```
aba1b1a app/team/page.tsx, lib/team.ts
60aca2a components/site/photo-slot.tsx
90aa943 components/device/vieve-showcase.tsx, components/site/annotated-diagram.tsx
9f0d6b9 app/demo/page.tsx, components/dash/demo-session.tsx, components/site/live-stroke.tsx, components/site/screen-tour-view.tsx, components/site/screen-tour.tsx, components/site/stroke-live-types.ts
```
None of these are imported anywhere in the current tree.

---

#### Couldn't check

- **Live database schema and data (CODE-001, CODE-008, CODE-010, CODE-014):** the Supabase MCP `list_projects` call was denied by the session's permission policy ("Production Reads"), so I could not run `select indexdef from pg_indexes where tablename = 'sessions'`, `select count(*) from sessions`, `list_migrations`, or the security/performance advisors. Owner can run, read-only, in the SQL editor:
  `select indexname, indexdef from pg_indexes where schemaname='public' and tablename in ('sessions','team_members','session_files');`
  `select polname, polcmd from pg_policy where polrelid = 'public.session_files'::regclass;`
  `select kind, count(*) from public.sessions group by kind;` (are there any successful uploads?)
  and `supabase migration list` to compare applied migrations with the five files in the repo.
- **Whether a real upload has ever succeeded in production** (would settle CODE-001 either way): needs the query above or one upload in a non-production project.
- **Supabase plan / backup / PITR status** and **Vercel project Node.js version and function region**: dashboard-only.
- **Playwright "Resource loading failures" from the previous session:** not reproducible here; the run was fully green and left no artifacts.
- **Raw HX711 count magnitude on a real node** (CODE-011 severity): depends on firmware tare/scale; not in this repo.
- **The signed-in upload test** (tests/app.spec.ts:25): skipped for lack of TEST_USER_EMAIL/PASSWORD, and would fail anyway (CODE-007); not run against the live site per ground rules.
- **Behaviour of `revalidatePath` + client router cache on /app/cox/[id]** after `setSeatSide`: reasoned from the docs; not observed in a browser because it needs a signed-in session.


## 3.10 Business and positioning (BIZ)

#### Competitor comparison table

| Product | Sensor location | What it measures | Per-seat sync | Price (public) | Dashboard / app | Trust signals on site | Source URL |
|---|---|---|---|---|---|---|---|
| **RowTech Force + Vieve (this site)** | Load cell in series on the rigger backstay | Force curve (raw sensor units until calibrated), peak & position, rise rate, work by thirds, catch/release timing, rate, rhythm, consistency. No oar angle, no boat speed, no power | Not yet: "Each node records its own seat today"; Vieve (in development) to put seats on one clock | Force: none. Vieve: "target price $499". Beta: "Discounted prices" (no anchor) | Node's own WiFi web page (files); gated team dashboard that "has only run on a made-up sample session"; no app | None: no photo of hardware, no testimonials, no customers, no team/about page (404), no contact email, no privacy/terms, no warranty, no social links, 5-question FAQ | https://www.rowtech.app/ |
| **Peach Innovations PowerLine** | Oarlock (replaces the swivel on a standard pin) | Force and angle at the pin -> power curves, catch/finish angle, timing, handle path; angle to 0.5 deg, force 2% of full scale; optional stretcher force, seat position | Yes, whole crew, wired system with coach display | ~US$10,250 basic system (Rowing News); stretcher sensors ~$1,400 each | Coach display in launch + PC software | Site could not be fetched (TLS error, twice). Rowing News: used by top crews; Frontiers 2021 validation paper; Ludum Platinum tier integrates Peach | https://www.rowingnews.com/the-rowing-technology-top-crews-are-using-to-win/ ; https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2021.758015/full ; http://www.peachinnovations.com/ (unfetchable) |
| **NK EmPower Oarlock (+ SpeedCoach GPS 2, CoxBox GPS)** | Oarlock (load cell + magnetometer inside the oarlock, magnet bar below) | 20+ metrics: catch angle, finish angle, effective length, peak force, power (W), work (J), slip, wash, force application; + GPS speed/split | One oarlock <-> one SpeedCoach; multi-rower comparison via LiNK Logbook "Team" (not live timing across seats; NK says so) | Oarlock $499; SpeedCoach GPS 2 $469; CoxBox Core $729 (GPS +$200) | SpeedCoach display on the boat; LiNK Logbook desktop/mobile; CoxBox GPS streaming | 2-year warranty; testimonials (Kleshnev/BioRow, Volker Nolte); 25+ FAQ; 5-part install videos; compatibility chart PDF (bushing sizes per boat maker); calibration manual; techsupport@ email + phone hours | https://nksports.com/empower-oarlock ; https://nksports.com/support/empower-oarlock/ ; https://nksports.com/coxbox-gps |
| **BioRow BioRowTel** | Oar shaft (handle force, 80 g wired/wireless), 2D oar angle sensor, seat/trunk sensors, master unit | Handle force, oar angle H+V, seat/trunk, boat speed/accel/rotation, wind, blade slip; per-rower curves | Yes, whole crew on one master unit; WiFi live to coach tablet | GBP 8,325 (product page, "2 units in stock") | PC software, tablet live view | Founder's research newsletters (2026 Worlds study, XBoat evaluation), WhatsApp + email contact, podcasts | https://biorow.com/product/biorowtel-system/ ; https://biorow.com/rbn2026_05/ |
| **XBoat Oarlock Force Sensor** | Force sensor inside a standard Concept2 sculling oarlock | Force, angle, power; 6.5" on-water display | Wireless pair of oarlocks; team pricing offered | $749 one-time, free US shipping | XBoat Rowing Monitor + XBoat Analytics (web) | 1-year warranty + lifetime support, 30-day returns, ships in 1 business day, help center. No testimonials. BioRow 2026 review: r=0.94 vs BioRow for power but "unsuitable for crew selection" | https://xboat.com/products/oarlock-scull |
| **smartOar** | Wireless sensor on the oar shaft near the pivot (<3 oz), any oar brand | Per-oar force curve, catch/release timing to 1/100 s, boat speed/accel; up to 8 oars live | Yes, 8 oars live to the coach's launch display / Android app | Not stated | Android app, coach tablet, PC software; self-recording | Testimonials: Univ. of Texas (4 national titles), Tennessee, U23 women's national staff; "husband-and-wife company" about; FAQs, video guides | https://www.smartoar.com/ |
| **RowTech Solutions (name clash)** | Sensor glued onto the existing plastic oarlock | Force and angle (+/-5 N, +/-1 deg, 100 Hz) -> watts; GPS boat unit adds tilt/accel/10 Hz GPS | Yes: GPS boat unit syncs up to 8 oarlock sensors | Sensor EUR 400 ex VAT; GPS unit EUR 600; software EUR 100/yr | Smartphone app + web platform, Garmin/Strava, API | Pricing page, testimonials (athlete, head coach, pro coach), about page with two named founders, info@ email, TikTok/Instagram/YouTube | https://www.rowtechsolutions.com/ ; https://www.rowtechsolutions.com/pricing |
| **Rowing in Motion** | Smartphone on the hull | Boat acceleration 100 Hz, GPS speed, rate; sonification | Boat-level only (no per-seat) | Not on homepage | iOS/Android app, logging, video | support@ email, help docs, "made for club coaches"; no testimonials on home | https://www.rowinginmotion.com/ |
| **Ludum (Telemetry tier)** | Software platform; hardware-agnostic (Garmin/Polar/Concept2; Peach on Platinum) | Force curves, rate, speed, balance when a telemetry source is attached; training management | Via integrated hardware (Peach) | Bronze $34/mo ... Platinum $100/mo; Telemetry $167/mo flat ($2,000/yr) | Cloud web + app | Logos: Rowing Australia, Princeton, Leander, Hampton; testimonials incl. Olympic medallist; Terms + Privacy; demo request; 5 social channels | https://ludum.com/ ; https://ludum.com/pricing/ |
| **Coxmate GPS** | Hull-mounted unit | Speed/split, rate, distance, DPS, HR, workouts, navigation | n/a (boat unit) | A$431 inc GST | PC analysis software (12 months included, then annual fee) | Manuals, warranty & returns page, support form, phone, distributor network | https://www.coxmate.com.au/product/coxmate-gps-2/ |

Reading of the table: every hardware competitor measures at the oar or oarlock and therefore has oar angle; every one with a per-seat story either ships whole-crew sync today (Peach, BioRow, smartOar, RowTech Solutions) or is explicit that it does not (NK). Every one shows a photograph of real hardware, a price or a quote path, and a contact channel. RowTech's site is the only one in the set with none of those three.

---

#### Findings

### BIZ-001 The first screen asks a sceptic to believe a product that has no photograph, no price, no people and no customers
- Severity: Critical
- Status: CONFIRMED
- Location: https://www.rowtech.app/ (hero, footer); components/site/hero.tsx:20-42; components/site/site-footer.tsx (whole file)
- What's wrong and why it matters: In the first 10 seconds a coach sees a vector render captioned "Force node, concept design", a headline that is a slogan rather than a claim, a CTA to "Apply for the beta", and no evidence that anyone has rowed with it. There is no image element on the home page (curl piped to grep "<img" returned nothing), no logo strip, no quote, no "used by", no team, no email. PRODUCT.md admits "no testimonials, press or logos yet"; the site should then compensate with the strongest thing it has (a real bench photo, a real on-water trace, a named founder) and it does neither. A coach will assume "student project, nothing shipped" and close the tab.
- Evidence: hero caption "Force node, concept design." (hero.tsx:33); "concept design" x8 on live /; footer = nav links + "(c) 2026 RowTech"; /team -> 404.
- Suggested fix: Put one real photograph (even a bench prototype on a rigger) above the fold with a date, and one sentence of who is building it with a contact email; keep the render as a secondary "what it will look like".
- Effort: S

### BIZ-002 The live headline is jargon that does not say what the product is
- Severity: High
- Status: CONFIRMED
- Location: components/site/hero.tsx:20; live /
- What's wrong and why it matters: "Making imperative data available to everyone, seat by seat." "Imperative data" is not a rowing or coaching term; "everyone" contradicts "For high school, college and club coaches" two lines lower. The page title ("RowTech: the force curve from every seat in the boat") and PRODUCT.md's remembered line ("every seat, every stroke, measured") are both clearer than the H1. A visitor from a shared link reads the H1 first and the title never.
- Evidence: live H1 quoted above vs title in app/layout.tsx:24-27.
- Suggested fix: Use the title line as the H1 ("The force curve from every seat in the boat.") and keep the subhead.
- Effort: S

### BIZ-003 "In beta / In development / concept design" saturates the page before any value is stated
- Severity: High
- Status: CONFIRMED
- Location: live /; app/page.tsx:41,53 (status chips), hero.tsx:33, app/vieve/page.tsx:26
- What's wrong and why it matters: Honesty is the brand, but the density is self-defeating: "beta" x44, "concept design" x8, "In development" x8 on one page, and the hero device itself is labelled a concept. The crew view (the one thing coaches want) is stamped "In development" and the copy then says comparing seats "needs two things we're still building". The net message is "nothing you want exists yet", which lands harder than the intended "we're honest".
- Evidence: counts above; live text "Each node records its own seat today. Comparing seats needs two things we're still building".
- Suggested fix: Keep the honesty in the existing "Where the build stands" section and strip the repeated qualifiers from the hero and product cards; lead each section with what works today.
- Effort: S

### BIZ-004 Sensor location is non-standard and the site never says what that costs the coach (no oar angle)
- Severity: High
- Status: CONFIRMED
- Location: lib/specs.ts:6 ("50 kg, in series on the rigger backstay"); live /force; app/page.tsx:23
- What's wrong and why it matters: Peach, NK EmPower, XBoat and RowTech Solutions measure at the oarlock; BioRow and smartOar at the oar. All get oar angle, so they report catch angle, finish angle, effective length, slip and wash: the metrics coaches already know from EmPower's "20+ measurements". A backstay load cell gives one scalar per sample: force along the stay, no angle, no handle path, no slip/wash, no power. The "One stroke, taken apart" section lists 7 measures and none of the angle-based ones, but never says "we do not measure angle"; a coach who owns an EmPower will notice and conclude the site is hiding it. The positive case (no oarlock swap, works with any oarlock, one clamp per seat) is also never made.
- Evidence: FORCE_SPECS has no angle row; live /force spec rows: Load cell / Electronics / Catch timing / Calibration / Screen / Keys / Seat number / Network / Storage / Battery. NK: "catch angle, finish angle, effective stroke length, peak force, power (watts), work (joules), slip, wash" (https://nksports.com/empower-oarlock).
- Suggested fix: Add a plain "What Force does not measure" line (angle, power, boat speed) beside the specs, and state the trade-off you chose.
- Effort: S

### BIZ-005 "Force" is not yet force: raw sensor units, while the hero screen shows kilograms
- Severity: High
- Status: CONFIRMED
- Location: live / hero screen "PEAK FORCE 61.4 kg"; app/page.tsx:103 (FAQ), app/force/page.tsx:27; lib/specs.ts:9
- What's wrong and why it matters: The hero and the stroke explorer show "61.4 kg peak", "245 kg/s", "9.2 kg"; the FAQ and Force page say no node has been calibrated and force reads in raw sensor units. The disclaimer sits under a collapsed FAQ and on a subpage; the kg numbers are what a visitor sees first. A sceptical coach reads that as a mock-up. Competitors state accuracy (Peach 2% of full scale, RowTech Solutions +/-5 N; NK ships a calibration manual).
- Evidence: live "Example stroke, drawn the way the node's live screen draws it, in kilograms as a calibrated node will read." vs FAQ "we haven't done that yet. Until we do, force reads in raw sensor units."
- Suggested fix: Run the 5-point bench calibration on one node and publish the worst-case error the firmware already reports; until then label the screen values "target display" in the caption rather than a footnote.
- Effort: M (calibration) / S (caption)

### BIZ-006 The headline crew promise ("whose catch is early") depends on Vieve, which does not exist
- Severity: High
- Status: CONFIRMED
- Location: app/page.tsx crew section; live "See whose catch is early, and who's carrying the boat."; app/vieve/page.tsx:26-31
- What's wrong and why it matters: The first section after the hero is the crew view and it is the only section that speaks to the primary user. It is honest that "Seat nodes have no clock of their own" and comparison needs Vieve (in development, $499 target). So the coach-facing promise is entirely future. smartOar and Peach show 8 seats live today; NK says explicitly that cross-rower timing is not supported. RowTech is closer to NK's position but presents like smartOar's.
- Evidence: live /vieve: "Seat nodes have no clock of their own. Vieve puts every seat on one, so catch timing can be compared seat to seat."
- Suggested fix: Move the crew view below "How it works" and label it a roadmap, or state an interim path (nodes started together / post-hoc alignment in the dashboard) if one is planned.
- Effort: S

### BIZ-007 No app, no live coach view: eight WiFi joins and CSV files per outing
- Severity: Medium
- Status: CONFIRMED
- Location: live / Step 3; app/page.tsx:31-34; FAQ "Where does the data go?"
- What's wrong and why it matters: Workflow: at the dock, join each node's WiFi from a phone, download four files per seat (strokes.csv, curves.bin, events.csv, meta.json), then upload to a dashboard that "has only run on a made-up sample session". For an eight that is eight WiFi joins per outing. Every competitor with per-seat data streams to a launch display or app. The site frames "no app to install" as a benefit; a coach reads "eight networks and CSV files" as the cost. Neither the time per seat nor whether one phone collects all seats is stated.
- Evidence: live "Onto each node's microSD card, and off it as plain files over the node's own WiFi."; "So far it has only run on a made-up sample session."
- Suggested fix: State the real dock workflow for a crew (minutes per seat, one phone or many) and put the dashboard demo (public/demo exists in the repo) in front of visitors so the payoff is visible.
- Effort: S

### BIZ-008 No price for Force anywhere; the beta "discount" has no anchor
- Severity: High
- Status: CONFIRMED
- Location: live / "What beta crews get: Testing units, for now / A direct line to the people building it / Discounted prices on all RowTech products"; live /vieve "The target price is $499."; lib/specs.ts:22
- What's wrong and why it matters: A coach budgeting a season needs an order of magnitude. Vieve has a target price; Force, the product that exists, has none. "Discounted prices" off an unknown number is not an incentive. Competitors either publish (NK $499/oarlock, XBoat $749, RowTech Solutions EUR 400 + 600 + 100/yr, Ludum tiers) or run a quote path (Peach). A per-seat target would also frame the backstay trade-off (BIZ-004) as a deliberate choice.
- Evidence: grep -i price on live /force returns nothing; live /vieve "Target price $499".
- Suggested fix: Publish a target per-seat price range for Force with the same "target" wording used for Vieve, and say what "discounted" means (percentage, or "beta crews keep their units").
- Effort: S

### BIZ-009 No pricing page at all; what a competitor's page does that this site does not
- Severity: Medium
- Status: CONFIRMED
- Location: components/site/site-header.tsx:7-11 and site-footer.tsx: no pricing link; no /pricing route
- What's wrong and why it matters: RowTech Solutions' pricing page lists three SKUs with specs and VAT status; Ludum's has tiers, per-user cost, a feature matrix and a demo CTA; NK lists MSRP on every product; XBoat lists warranty, returns and shipping beside the price. A pricing page is also where "what does a crew need" gets answered (N x Force + 1 Vieve). Without it the visitor cannot size the purchase.
- Evidence: https://www.rowtechsolutions.com/pricing ; https://ludum.com/pricing/ ; https://xboat.com/products/oarlock-scull ("1-Year Warranty with Lifetime Support", "30-Day Returns").
- Suggested fix: One /pricing page with a crew sentence (N seats x Force + 1 Vieve), target prices, and what beta crews pay.
- Effort: S

### BIZ-010 /team was linked and is now a bare 404; company identity is gone from the site
- Severity: High
- Status: CONFIRMED
- Location: https://www.rowtech.app/team -> 404 (default Next.js page, no not-found.tsx); commit aba1b1a "site: remove the team page for now"; lib/team.ts absent
- What's wrong and why it matters: The one trust signal a pre-revenue hardware startup can always offer is the people. Removing the page leaves no founder name, location, affiliation or about text anywhere. Anyone who saved or shared the old /team URL hits an unstyled "404: This page could not be found". RowTech Solutions shows two named founders; smartOar says "husband-and-wife company".
- Evidence: curl -sI https://www.rowtech.app/team -> HTTP/1.1 404 Not Found; body "404 This page could not be found."; ls app has no team dir.
- Suggested fix: Restore a minimal /team (names, roles, city, one line of background, email) and add a styled not-found.tsx.
- Effort: S

### BIZ-011 No contact email, no social links, no privacy or terms
- Severity: High
- Status: CONFIRMED
- Location: components/site/site-footer.tsx (no mailto, no social); grep for mailto/contact/@rowtech across app, components, lib returns nothing; /privacy and /terms 404 (the audit brief)
- What's wrong and why it matters: The beta form is the only way to reach the company. A coach who wants to ask "does it fit a wing rigger?" before applying cannot. The form says "We'll only use this to talk to you about the RowTech beta" with no privacy policy behind it, and the dashboard collects session uploads with GPS points under no stated terms. Every competitor page fetched had at least an email; Ludum and Coxmate had legal pages. Schools and universities increasingly require a privacy policy before staff can submit data to a vendor.
- Evidence: footer nav = How it works / Force / Force specifications / Vieve / Vieve specifications / The beta / "(c) 2026 RowTech"; live /beta "We'll only use this to talk to you about the RowTech beta."
- Suggested fix: Add a contact address to the footer and beta page, a one-page privacy notice, and a social/YouTube link once a video exists.
- Effort: S

### BIZ-012 Validation and accuracy: nothing to show, and the FAQ says so
- Severity: High
- Status: CONFIRMED
- Location: live / FAQ "How accurate is it?"; live /force "Calibration, and where it stands"
- What's wrong and why it matters: The honest answer ("we haven't done that yet") offers no substitute proof: no bench trace, no on-water session file, no comparison against a known weight, no date for calibration. NK leans on BioRow; XBoat gets reviewed by BioRow; Peach has a Frontiers paper. A single published raw session (the four files) plus a plot would move the "measures something real" rung of the belief ladder more than any copy.
- Evidence: live FAQ "each node has to be calibrated against known weights, and we haven't done that yet."; specs row "Not yet run on a node".
- Suggested fix: Publish one real recorded session (files + chart) with the date and boat, and a calibration date target.
- Effort: M

### BIZ-013 FAQ: five questions, two of which are non-answers
- Severity: Medium
- Status: CONFIRMED
- Location: app/page.tsx:84-105; live / "Questions a coach might ask."
- What's wrong and why it matters: Q1 (boathouse WiFi) good. Q2 (replace cox box) honest. Q3 "Which boats and riggers does it fit?" answers "The load cell mounts on the rigger backstay. Tell us which boats you row when you apply": the question a coach most needs answered, deferred to the form; NK publishes a compatibility chart by boat maker and pin type. Q4 (data) fine. Q5 (accuracy) ends "The Force page has the numbers" when the Force page says the numbers do not exist yet. Missing: price, sweep vs scull, battery hours on the water, waterproofing, what if a node is dropped, how many seats one phone collects, who owns the data, when the beta starts and how long it runs, what beta crews owe.
- Evidence: live FAQ text.
- Suggested fix: Answer Q3 with what is known (stay diameter range, sweep/scull, tested riggers) and add 5-6 questions including price and beta terms.
- Effort: S

### BIZ-014 Warranty, support and returns: not mentioned
- Severity: Medium
- Status: CONFIRMED
- Location: whole site; grep -i warranty on live pages returns nothing
- What's wrong and why it matters: For hardware clamped to a rigger on the water, "what if it gets wet / dropped / breaks" is the second question after price. NK: 2-year warranty; XBoat: 1-year + lifetime support + 30-day returns; Coxmate: warranty & returns page. A beta can still say "we replace any unit that fails during the beta" at no cost today.
- Evidence: competitor pages cited in the table.
- Suggested fix: One sentence under "What beta crews get": what happens when a unit fails and who to email.
- Effort: S

### BIZ-015 Trust-signal gap, ranked by conversion impact
- Severity: High
- Status: SUSPECTED (ranking is a judgment; each gap is CONFIRMED above)
- Location: site-wide
- What's wrong and why it matters: Ranked by how much each missing item would move a sceptical coach from "close tab" to "apply": (1) a real photograph of hardware on a rigger; (2) one real recorded session or bench trace with a date; (3) who is building it and an email; (4) a per-seat target price; (5) a compatibility statement (sweep/scull, backstay sizes tested); (6) beta terms (start, duration, obligations, what happens to units); (7) privacy policy; (8) warranty/replacement line; (9) fuller FAQ; (10) social/video; (11) press/customers (not available yet; do not fake).
- Evidence: BIZ-001, 010, 011, 012, 008, 013, 014.
- Suggested fix: Do (1)-(4) before any further design work.
- Effort: M overall

### BIZ-016 The beta form is good; what happens after it is under-specified
- Severity: Medium
- Status: CONFIRMED
- Location: app/beta/signup-form.tsx:12-15 (NEXT_STEPS), :27-40 (Done); app/beta/actions.ts:29-37 (sendConfirmation no-op)
- What's wrong and why it matters: Three required fields, optional boats/role/location/message, a honeypot, clear errors: a light ask, well built. After submit: "We read your application. Every one, properly." / "We get in touch by email." / "No email from us yet? That's expected: we reply personally, not automatically." No timeframe, no confirmation email (the provider stub does nothing), no copy of what was sent. A coach who applies from a phone at the boathouse has nothing in their inbox and no idea whether "personally" means two days or two months. "Not automatically" reads as a virtue but is a gap.
- Evidence: signup-form.tsx:37 quoted; actions.ts:33-37 TODO: send confirmation email.
- Suggested fix: State a reply window ("within 5 days") on the Done screen and wire a one-line confirmation email so the applicant has a record and a reply-to address.
- Effort: S

### BIZ-017 The beta offer does not say what the beta is
- Severity: Medium
- Status: CONFIRMED
- Location: live / "Applying for the beta." section; app/page.tsx beta section
- What's wrong and why it matters: "Testing units, for now" / "A direct line" / "Discounted prices": no start date, duration, number of crews, nodes per crew, cost (free? loan? deposit?), obligations (feedback calls? data sharing?) or geography. "We're choosing beta crews now" appears three times with no closing date. A coach cannot bring this to an athletic director. PRODUCT.md's "Nothing specific is promised" is a constraint, but "we can't say yet" stated plainly beats silence.
- Evidence: live text quoted; "We're choosing beta crews now." in hero, closing and beta sections.
- Suggested fix: A short "How the beta works" block: when, how many crews, what a crew receives, what it costs, what we ask back, where we can ship.
- Effort: S

### BIZ-018 Login page and dashboard gate send non-beta users in a loop with no value
- Severity: Low
- Status: CONFIRMED
- Location: app/app/login/page.tsx:25-31; app/app/(dash)/request-access.tsx:13-31
- What's wrong and why it matters: /app/login says "The RowTech dashboard is for beta crews. Apply for the beta if you're not in yet." A curious coach who signs in with Google anyway (shouldCreateUser:true) lands on "The dashboard is for beta crews ... we'll turn your account on when your crew joins" and "Reply to our email", an email that was never sent (BIZ-016). The copy is clear, but the flow creates an auth.users row and a dead end. No public demo of the dashboard, although public/demo exists.
- Evidence: request-access.tsx:30 "Already applied, or already rowing with us? Reply to our email and we'll sort it out."
- Suggested fix: Link a read-only demo session from the login and request-access pages, or hide sign-in until an applicant is approved.
- Effort: S

### BIZ-019 Dashboard empty state assumes hardware the beta user may not have yet
- Severity: Low
- Status: CONFIRMED
- Location: app/app/(dash)/force/page.tsx:52
- What's wrong and why it matters: "Nothing here yet. Upload a session from a node and it lands here." An approved coach whose units have not shipped sees an empty list and a file uploader: no sample session to click, no "your units ship on ...", no link to the file format. The home page admits the dashboard "has only run on a made-up sample session"; that sample should be the empty state.
- Evidence: page.tsx:52 quoted.
- Suggested fix: Seed the empty state with the sample outing and one line on where the four files come from.
- Effort: S

### BIZ-020 Time-to-value for a coach who applies today is undefined and probably months
- Severity: High
- Status: SUSPECTED
- Location: live / "Where the build stands"; beta Done screen
- What's wrong and why it matters: Chain for a coach applying 2026-09-24: application stored -> personal reply (no window) -> selected (no criteria) -> units built (case is a concept) -> calibrated (not yet) -> shipped -> installed (fit unknown) -> row -> collect files -> upload to a dashboard tested only on synthetic data -> per-seat comparison needs Vieve (in development). Nothing lets the coach estimate this; competitors ship in one business day (XBoat) or from stock (BioRow). The autumn season is the decision window and the site does not say whether the beta is this autumn or spring 2027.
- Evidence: hardware/ is untracked in git status (hardware work exists but the site says nothing about build status); live copy in BIZ-003/005/006.
- Suggested fix: Publish a dated build-status line ("first 8 nodes on the bench, October 2026; first crew on the water, target ...") and update it as the site's only changelog.
- Effort: S

### BIZ-021 "Coaches first" is stated but the product on the page is athlete-first
- Severity: Medium
- Status: CONFIRMED
- Location: components/site/hero.tsx:20-29; live /
- What's wrong and why it matters: The audience line is above the fold, which is good. But everything that works today serves the rower: "shows it to the rower live", "The rower sees their own peak and curve", the hero device is a per-seat screen. The coach's payoff (crew view, catch spread, side balance, dashboard) is "In development" or "Coming next". A coach reads: athlete toy now, coach tool later. The secondary audience (scullers) is the one the current product fits best and is not addressed at all.
- Evidence: live Step 2 "The rower sees their own peak and curve."; NEXT list in app/page.tsx:75-82 holds every coach-facing item.
- Suggested fix: Add a "for scullers and small boats" door (the product works for a 1x today) or make the coach payoff of single-seat data explicit (consistency across a session, rate/rhythm per athlete, compare two outings).
- Effort: S

### BIZ-022 Boat class and rigging compatibility is never stated
- Severity: High
- Status: CONFIRMED
- Location: app/page.tsx:93-96 (FAQ Q3); lib/specs.ts (no fit row); live /beta boat chips 1x ... 8+
- What's wrong and why it matters: The beta form lets you tick 1x through 8+, implying all fit, while the FAQ says "Tell us which boats you row when you apply", implying unknown. Nothing says whether it fits wing riggers (many have no backstay), aluminium vs carbon stays, stay diameter range, sweep and scull, or which makers were tested. NK ships a per-maker compatibility chart; RowTech Solutions says "any kind of existing oarlock (made from plastic)". For a coach with a fleet of wing-rigged boats this is a disqualifier they cannot check.
- Evidence: FAQ Q3 text; NK compatibility chart (https://nksports.com/support/empower-oarlock/).
- Suggested fix: Add a "Fits" spec row: rigger types, stay diameter range, sweep/scull, tested boats; say plainly which riggers it does not fit.
- Effort: S

### BIZ-023 The name "RowTech" is already taken by a direct competitor in the same category
- Severity: Critical
- Status: CONFIRMED
- Location: https://www.rowtechsolutions.com/ ; web results for "RowTech rowing"
- What's wrong and why it matters: A search for "RowTech rowing" returns (1) Hammer "RowTech NorsK" rowing machines, (2) RowTech Solutions (rowtechsolutions.com), which sells a glue-on oarlock force-and-angle sensor (EUR 400), a GPS boat unit that syncs 8 oarlocks (EUR 600) and a EUR 100/yr app: the exact category, with a pricing page, testimonials, two named founders and social channels; (3) "Davies RowTech" (UK); (4) a YouTube channel @rowtech7423. rowtech.app does not appear for its own name. Any coach who hears "RowTech" and searches lands on the competitor, which is further along. Social handles are already used.
- Evidence: WebSearch "RowTech rowing" result list; rowtechsolutions.com headline "POWER SENSORS FOR PEAK PERFORMANCE"; https://www.rowtechsolutions.com/pricing fetched.
- Suggested fix: Decide now, before units and beta crews carry the name: rebrand (Force and Vieve already have names that could carry the company) or accept the clash and buy the SEO fight with a qualifier. At minimum register the obvious handles and check trademark status in your jurisdiction.
- Effort: L (rebrand) / S (decision)

### BIZ-024 The site does not use the words coaches search for
- Severity: Medium
- Status: CONFIRMED
- Location: live /, /force; app/layout.tsx:24-47
- What's wrong and why it matters: Coach queries (from the competitor set's own titles): "rowing force measurement", "oarlock force sensor", "rowing telemetry", "force curve rowing", "rowing power meter", "rowing biomechanics". On the live home page: "force measurement" 6 (mostly meta/footer), "force curve" 24 (good), "telemetry" 0, "oarlock" 0, "biomechanics" 0, "power"/"watts" 1/0. Avoiding "power" is deliberate and fine, but "telemetry" is the category word every competitor uses (Peach "Rowing Telemetry and Instrumentation", Ludum "Telemetry", BioRow "BioRowTel"), and "oarlock" is what people search even when the answer is "we don't use one". The /force title "Force, the seat node" carries no category term.
- Evidence: keyword counts from curl piped to sed and grep -c; competitor page titles.
- Suggested fix: One sentence per page naming the category in plain words ("rowing telemetry: a force sensor on every seat, without replacing the oarlock"); put "rowing force measurement" in the /force subline. The SEO agent covers technicals.
- Effort: S

### BIZ-025 Vieve competes with NK CoxBox and Coxmate on a spec sheet with no audio, IP rating, hours or harness plan
- Severity: Medium
- Status: CONFIRMED
- Location: lib/specs.ts:18-23; live /vieve
- What's wrong and why it matters: Vieve specs: 5" 1000 nit screen, u-blox GPS 10 Hz, radio to seat nodes, 5000 mAh, $499 target. NK CoxBox Core is $729 (GPS +$200), Coxmate GPS A$431, and both lead with what a cox needs: audio, waterproof rating (IP67, floats), battery hours, harness/mount compatibility, 2-year warranty. Vieve's page says "carry the cox's voice" but lists no amplifier, mic, speaker, harness compatibility, IP rating or hours. A coach with an NK harness in every boat will ask whether Vieve plugs in.
- Evidence: live /vieve spec table; https://nksports.com/coxbox-gps ("IP67", "10+ hours", "backwards compatible with legacy harnesses").
- Suggested fix: Add the cox-box basics as "target" rows, or say Vieve is a data hub first and the cox-box function comes later.
- Effort: S

### BIZ-026 "Two products, one system" sells a system, but only one product exists and the system needs both
- Severity: Medium
- Status: CONFIRMED
- Location: app/page.tsx products section; live "Two products, one system."
- What's wrong and why it matters: Per-seat comparison (the system's value) needs Force x N and Vieve. Force exists as firmware on a concept case; Vieve is in development. The page invites the coach to imagine a full-boat system and then says neither half is done. Competitors that sell a system (Peach, BioRow, smartOar) sell it complete; those that sell one piece (NK) say it is one piece.
- Evidence: live "Two products, one system." followed by "Where the build stands."
- Suggested fix: Reframe as "Force today, Vieve next" and describe what one Force on one seat gives a coach this season.
- Effort: S

### BIZ-027 The site's real differentiators are never stated as claims
- Severity: Medium
- Status: SUSPECTED
- Location: whole site
- What's wrong and why it matters: Against the set, RowTech's genuine differences are (a) nothing replaces or glues to the oarlock: no rigging change, no oarlock-size compatibility problem; (b) every seat has its own screen, so the rower sees their curve without a coach tablet (NK needs a $469 SpeedCoach per seat; smartOar/Peach show the coach); (c) open files on microSD, no cloud subscription (RowTech Solutions EUR 100/yr, Ludum $2,000/yr telemetry, Coxmate annual fee); (d) a potential price far under Peach/BioRow. None is stated as a comparison; "There's nothing to install" is the closest. "No subscription" is a strong line for a club treasurer and never appears.
- Evidence: competitor table; live copy has no "no subscription", "no oarlock change" or price-per-seat claim.
- Suggested fix: A short "How it compares" section with 3-4 rows (sensor location, per-seat screen, file ownership/subscription, price per seat), stated as facts.
- Effort: S

### BIZ-028 Stroke-model numbers presented beside "The node measures every stroke like this"
- Severity: Low
- Status: CONFIRMED
- Location: live / "Example stroke 147, 28.4 spm peak 61.4 kg", "Example data. The node measures every stroke like this"; PRODUCT.md "computed from the same stroke model ... not typed in"
- What's wrong and why it matters: The numbers are synthetic and the copy says "Example", which is honest, but "The node measures every stroke like this, on every seat that has one" beside a synthetic curve invites the sceptic to ask "show me one it measured". PRODUCT.md's own principle is "The real screens and real curves are the imagery".
- Evidence: live text quoted.
- Suggested fix: Pair the example stroke with one recorded stroke from a node, dated, even in raw units.
- Effort: M

### BIZ-029 Share-preview copy is clearer than the page it lands on
- Severity: Info
- Status: CONFIRMED
- Location: app/page.tsx jsonLd; app/layout.tsx openGraph; live og: meta tags
- What's wrong and why it matters: A shared link (the primary arrival path per PRODUCT.md) previews as "RowTech: the force curve from every seat in the boat / Seat-by-seat force measurement for rowing. Coaches: apply for the beta." That is the clearest statement of the product on the site; the visitor then lands on "Making imperative data available to everyone".
- Evidence: og:title / og:description on live /.
- Suggested fix: See BIZ-002; make the H1 match the preview.
- Effort: S

### BIZ-030 Quick wins ranked by expected effect on beta applications
- Severity: Info
- Status: SUSPECTED
- Location: n/a
- What's wrong and why it matters: Ten cheap changes, most impactful first:
  1. Replace the H1 with "The force curve from every seat in the boat." so the page says what it is in five seconds (BIZ-002).
  2. Put one real, dated photograph of a node on a rigger in the hero and demote the render to the Force page (BIZ-001).
  3. Add a contact email to the footer and the beta page (BIZ-011).
  4. Restore a one-screen /team with names, city and background, and add a styled 404 (BIZ-010).
  5. Publish a target per-seat price for Force and define "discounted" (BIZ-008).
  6. Add a "Fits" row to the Force specs and rewrite FAQ Q3 with what is known (BIZ-022, BIZ-013).
  7. Add a "How the beta works" block: when, how many crews, what you get, what it costs, what we ask (BIZ-017).
  8. Put a reply window on the Done screen and send a one-line confirmation email (BIZ-016).
  9. Add a "What Force does not measure" line and the "no oarlock change, no subscription" comparison (BIZ-004, BIZ-027).
  10. Publish one real recorded session file + chart with a date, and a dated build-status line (BIZ-012, BIZ-020).
- Evidence: findings above.
- Suggested fix: Ship 1-5 in one PR; they are copy and one image.
- Effort: S

---

#### Couldn't check
- Peach Innovations website (peachinnovations.com): TLS handshake fails from this environment (TLSV1_ALERT_INTERNAL_ERROR, two attempts). Peach facts come from Rowing News and the Frontiers 2021 paper; Peach's own trust pages (customers, FAQ, support) not verified.
- Whether the old /team URL was ever shared externally or indexed (no Search Console access); live status today is 404.
- Actual beta reply time, selection criteria, number of crews, shipping geography: not on the site and not in the repo.
- Smartphone rendering of the hero (text-only fetch; screenshots are the UX agent's job).
- Search rankings for "rowtech rowing" over time (single WebSearch snapshot, US-only index).
- Trademark status of "RowTech" in the US/EU/UK: not searched (no trademark database access); recommended as a manual check.
- Whether beta_signups holds any applications (no database reads allowed).
- smartOar and Rowing in Motion publish no price; Peach price is second-hand (Rowing News).
- Vieve audio hardware plan (may exist in the untracked hardware/ dir; outside the audit inputs, not read).


## 3.11 Lead findings from live Supabase and Vercel checks, and the final read-through (LEAD)

These come from read-only queries the specialist passes could not run (the Supabase MCP was available to the lead only), plus the final pass over every file.

### LEAD-001 Supabase Security Advisor: two SECURITY DEFINER functions are executable by every signed-in user
- Severity: Low
- Status: CONFIRMED (live advisor + `pg_proc`)
- Location: `supabase/migrations/20260922180222_allowed_users.sql:19-32` (`is_beta_user`), `supabase/migrations/20260922180943_session_model.sql:32-40` (`is_team_member`)
- What's wrong and why it matters: The advisor lint `authenticated_security_definer_function_executable` (WARN) flags both functions as callable via `/rest/v1/rpc/...` by the `authenticated` role. `is_beta_user()` is meant to be called by the app (`lib/supabase/server.ts:46`). `is_team_member(uuid)` is only needed inside policies, yet any signed-in user can call it with arbitrary uuids to test whether they belong to a team. Both are `security definer` with `search_path = ''` and are revoked from `anon` (verified live: anonymous RPC returns 401 "permission denied for function"), so this is hygiene rather than a hole.
- Evidence: Supabase `get_advisors(security)` output: "Function `public.is_team_member(team uuid)` can be executed by the `authenticated` role as a `SECURITY DEFINER` function via `/rest/v1/rpc/is_team_member`"; remediation https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Suggested fix: Revoke EXECUTE on `is_team_member` from `authenticated` (policies still work because the function is security definer and owned by postgres), or move both helpers to a private schema and expose only what the app calls.
- Effort: S

### LEAD-002 Supabase default grants: `anon` and `authenticated` hold SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER on every dashboard table; RLS is the only barrier
- Severity: Low
- Status: CONFIRMED (live `information_schema.role_table_grants`)
- Location: all tables created by `supabase/migrations/20260922180222_allowed_users.sql`, `20260922180943_session_model.sql`, `20260922183932_vieve_gps.sql`, and the `session_stats` view
- What's wrong and why it matters: Supabase's default privileges grant everything on new `public` objects to `anon`, `authenticated` and `service_role`. The migrations never revoke them, so the `anon` role (the publishable key with no JWT) has table-level privileges on `allowed_users`, `teams`, `team_members`, `boats`, `seats`, `sessions`, `session_files`, `strokes`, `gps_points` and `session_stats`. Row Level Security is enabled on all ten tables and there are no `anon` policies, so today every anonymous request returns zero rows (verified live: `GET /rest/v1/allowed_users` with the publishable key returns `200 []`, Storage list returns `[]`). The exposure is defence in depth: one careless policy `to public` or one `alter table ... disable row level security` would expose the table to the internet, and `TRUNCATE` is not governed by RLS at all (PostgREST exposes no truncate operation, so there is no known path today). `beta_signups` is the exception and is done right: `anon` holds column-level INSERT only, `authenticated` holds nothing, and an anonymous SELECT returns 401 "permission denied for table beta_signups".
- Evidence: `select grantee, table_name, privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated')` returns all seven privileges for both roles on every table except `beta_signups`; live curl probes as described.
- Suggested fix: Add a migration that revokes all on the dashboard tables from `anon` and grants only SELECT/INSERT/UPDATE/DELETE to `authenticated` (never TRUNCATE/REFERENCES/TRIGGER); consider `alter default privileges in schema public revoke ...` so new tables start closed.
- Effort: S

### LEAD-003 Supabase Performance Advisor: three unindexed foreign keys and one per-row `auth.jwt()` evaluation in an RLS policy
- Severity: Low
- Status: CONFIRMED (live advisor)
- Location: `sessions.boat_id`, `sessions.created_by`, `teams.created_by` (no covering index); `supabase/migrations/20260922180222_allowed_users.sql:14-16` (policy `read own entry` uses `auth.jwt()` unwrapped)
- What's wrong and why it matters: The advisor reports `unindexed_foreign_keys` (INFO) for the three FKs and `auth_rls_initplan` (WARN) for the `allowed_users` policy, whose `lower(auth.jwt() ->> 'email')` is re-evaluated per row instead of once via `(select ...)`. It also lists four indexes as unused (`team_members_user_idx`, `boats_team_idx`, `sessions_team_time_idx`, `sessions_parent_idx`), which is expected with zero rows. Impact is nil today; `sessions.boat_id` matters once boats are deleted (cascade check) and lists are filtered by boat.
- Evidence: `get_advisors(performance)` output, remediation links https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys and ...?lint=0003_auth_rls_initplan
- Suggested fix: Add `create index on sessions (boat_id)`, `(created_by)`, `teams (created_by)`; rewrite the policy as `email = lower((select auth.jwt()) ->> 'email')`.
- Effort: S

### LEAD-004 The live schema confirms CODE-001, CODE-010 and CODE-014
- Severity: Info (raises the three referenced findings to CONFIRMED)
- Status: CONFIRMED (live `pg_indexes`, `pg_policies`, `list_migrations`)
- Location: see the referenced findings
- What's wrong and why it matters: (a) `sessions_device_uuid_idx` is live exactly as in the migration: `CREATE UNIQUE INDEX ... ON public.sessions USING btree (team_id, device_id, session_uuid) WHERE ((device_id IS NOT NULL) AND (session_uuid IS NOT NULL))`. There is no non-partial unique constraint on those columns, so the ON CONFLICT clause the upload emits has no arbiter (CODE-001). (b) `session_files` has exactly three policies live (`members read`, `members write`, `members delete`) and no UPDATE policy, so the upsert on re-upload is denied (CODE-010). (c) The database has six applied migrations; the first, `20260913224311 create_beta_signups`, is not in the repo (CODE-014). (d) Row counts: `beta_signups` 3, `allowed_users` 1, every dashboard table 0, Storage bucket empty: no real upload has ever succeeded in production.
- Evidence: Supabase MCP query results recorded in the scratchpad (`findings-lead.md`).
- Suggested fix: See CODE-001, CODE-010, CODE-014. Dump the missing migration from the live database into the repo.
- Effort: S

### LEAD-005 `beta_signups` is protected as the README claims, and duplicates are de-duplicated by a unique index on `lower(email)`
- Severity: Info (resolves SEC-003)
- Status: CONFIRMED (live)
- Location: `public.beta_signups`
- What's wrong and why it matters: Nothing wrong. RLS is enabled; the only policy is `anyone can sign up` (INSERT to `anon`, `with check (true)`); `anon` holds column-level INSERT on the 16 form columns and nothing else; `authenticated` holds nothing; `beta_signups_email_key` is a unique index on `lower(email)`, so the 23505 branch in `app/beta/actions.ts:96-98` does fire and repeat applications are silently dropped (see LEG-018, CNT-013). Constraints on the base table match `app/beta/fields.ts` limits (name 1-120, email 254 + regex, organization 160, location 120, message 2000, role enum, legacy `seats` enum and `source` 200).
- Evidence: `pg_policies`, `column_privileges`, `pg_indexes`, `pg_constraint` on the live project; anonymous `GET /rest/v1/beta_signups?select=id` returns 401.
- Suggested fix: Commit the `20260913224311` migration so this is reviewable from the repo. Treat SEC-003 as closed.
- Effort: S

### LEAD-006 Vercel: production environment variables could not be listed; preview deployments are protected; `rowtech.vercel.app` is a public second origin
- Severity: Info
- Status: CONFIRMED (Vercel MCP + curl) / NEEDS MANUAL CHECK (env vars)
- Location: Vercel project settings
- What's wrong and why it matters: `filter_project_envs` returned 403 "You don't have permission to list the project environment variable", so whether `SITE_URL`, `BETA_DRY_RUN` and `NEXT_PUBLIC_POSTHOG_KEY` are set in production is unverified from the API (the live `og:image` URL and the absence of a PostHog key in served chunks say `SITE_URL` is set and the PostHog key is not). Deployment protection is `ssoProtection: all_except_custom_domains`, and all three non-custom URLs tested (`rowtech-aousg0vce-...vercel.app` preview, `rowtech-git-main-...vercel.app`, `rowtech-notrelaxed11-3656s-projects.vercel.app`) return 302 to the Vercel login, so previews are not public (closes the open item in SEC-023). `rowtech.vercel.app` is a production alias and serves the full site with 200 (SEC-023 stands). Password protection is off; trusted IPs off; Node 24.x.
- Evidence: Vercel MCP `get_project`, `list_project_domains`; curl status codes.
- Suggested fix: Redirect `rowtech.vercel.app` to `https://www.rowtech.app` in Vercel Domains; confirm the three env vars by hand.
- Effort: S

### LEAD-007 The hero's stroke counter increments forever while visible, drifting away from the "Example stroke 147" the rest of the page quotes
- Severity: Info
- Status: CONFIRMED (code)
- Location: `components/device/screen-animator.tsx:50-56, 81-88`
- What's wrong and why it matters: Every simulated catch does `count.textContent = String(first + n)`, and `resume()` carries the count across pauses (`first += Math.max(0, shown)`). After a minute on the page the hero screen says "STROKE 175" while the explorer two sections down still says "Example stroke 147, 28.4 spm" and the OG image says 147. Cosmetic; noted because the site's stated principle is that every number is computed from one model.
- Evidence: lines cited.
- Suggested fix: Hold the counter at 147, or let the explorer read the same live counter.
- Effort: S

### LEAD-008 The hero curve strip animates `clip-path` on a full-width SVG at 60 fps, in addition to the JavaScript animator
- Severity: Info (contributes to PERF-003)
- Status: SUSPECTED
- Location: `app/globals.css:246-257` (`@keyframes rt-stroke-reveal` on `.rt-stroke-reveal`, `rt-stroke-cursor` animating `left`), `components/site/scope-strip.tsx:72, 77`
- What's wrong and why it matters: The scope strip's reveal is a CSS `clip-path: inset(...)` animation on an SVG that spans the viewport, and the cursor animates `left`, neither of which is compositor-only; both repaint every frame for as long as the hero is on screen. Combined with the rAF animator that rewrites SVG attributes (PERF-003), the hero is two continuous paint sources. Reduced motion disables both (verified by the UX pass).
- Evidence: CSS cited; Lighthouse home mobile "Style & Layout 2,076 ms" (PERF-003).
- Suggested fix: Animate `transform: scaleX()` on a clipping wrapper, or `stroke-dashoffset` on the path, and move the cursor with `transform: translateX()`.
- Effort: S

### LEAD-009 Dashboard stroke list uses `role="listbox"` / `role="option"` with buttons inside the options and a non-focusable listbox
- Severity: Low
- Status: CONFIRMED (code; dashboard not exercised live)
- Location: `components/dash/stroke-timeline.tsx:158-212`
- What's wrong and why it matters: The scroller is `role="listbox"` with `tabIndex={-1}` and `aria-activedescendant`, so it is never focused and the active-descendant relationship never applies; each `role="option"` row contains two `<button>`s (select and compare), which the ARIA spec forbids (options must not contain interactive children), so screen readers will announce a listbox they cannot operate and buttons inside "options". The virtualised rows are otherwise well built. The `StrokeTimeline` slider above it (`role="slider"`, arrow keys, Home/End) is correct.
- Evidence: lines cited.
- Suggested fix: Drop the listbox semantics and render a plain `<table>` or `<ul>` of rows with the two buttons, or make the listbox itself focusable and move selection/compare onto keyboard shortcuts.
- Effort: S

### LEAD-010 Arrow keys are captured by the 3D stage and the stroke explorer marker buttons hover-activate on pointer entry
- Severity: Info
- Status: CONFIRMED (code)
- Location: `components/site/device-diagram-3d.tsx:186-191`; `components/site/curve-explorer-view.tsx:90-91`
- What's wrong and why it matters: When the 3D stage has focus, ArrowUp/ArrowDown call `preventDefault()` and turn the model, so a keyboard user who tabs onto it cannot scroll the page with the arrows until they tab away; that is acceptable for a widget but only if the hint text says so (it does: "Drag the model, or use the arrow keys, to turn it."). In the stroke explorer, `onPointerEnter` on each marker changes the active metric, so moving the mouse across the chart flips the explanation text under it repeatedly; `aria-live="polite"` on that text (line 274) means a screen reader with a mouse user nearby hears every change. Minor.
- Evidence: lines cited.
- Suggested fix: Keep arrow capture; consider activating markers on click/focus only and leaving hover to the cursor spring.
- Effort: S



---

## 4. Checklist of all findings, sorted by severity

Tick the first column as you work through them. Status is the audit's confidence, not the fix state. Effort: S under a day, M a few days, L a week or more.

| Done | ID | Severity | Status | Finding | Effort |
|---|---|---|---|---|---|
| [ ] | BIZ-001 | Critical | CONFIRMED | The first screen asks a sceptic to believe a product that has no photograph, no price, no people and no customers | S |
| [ ] | BIZ-023 | Critical | CONFIRMED | The name "RowTech" is already taken by a direct competitor in the same category | L (rebrand) / S (decision) |
| [ ] | SEC-001 | High | CONFIRMED | Any beta user can join ANY team (as "owner") — `team_members` insert policy does not constrain `team_id` or `role` | S |
| [ ] | SEC-002 | High | CONFIRMED | `next` 16.2.3 carries a Critical advisory set; several entries are reachable in this app's configuration | S |
| [ ] | LEG-001 | High | CONFIRMED | No privacy policy or terms exist, but personal data is collected on two pages | M |
| [ ] | LEG-002 | High | CONFIRMED | The only privacy statement on the site does not match what is actually stored | S |
| [ ] | LEG-003 | High | NEEDS MANUAL CHECK | Google sign-in in production needs a privacy policy on the consent screen and on the homepage; button/logo do not follow Google's branding guidelines | S (button) / M (verification) |
| [ ] | LEG-004 | High | SUSPECTED | Athlete performance and location data is uploaded by coaches about people who never consent, including likely minors, with no DPA, retention or deletion terms | L |
| [ ] | CODE-001 | High | CONFIRMED | Session upsert targets a PARTIAL unique index; Postgres cannot infer it, so every node-session upload likely fails | S (schema) / M (verify + migrate) |
| [ ] | CODE-002 | High | CONFIRMED | `recorded_at` from a datetime-local input is parsed as server-local time (UTC on Vercel), so the stored time is off by the coach's UTC offset | S |
| [ ] | CODE-003 | High | CONFIRMED | `uploadSession` is a non-transactional chain of ~10 writes; every partial failure leaves orphan rows or files | L |
| [ ] | CODE-004 | High | CONFIRMED | Re-uploading a multi-seat outing creates a second crew parent and orphans the first (crew rows have no idempotency key) | M |
| [ ] | CODE-005 | High | CONFIRMED | No error boundaries, no not-found page, and every page-level Supabase error is swallowed: outages render as "Nothing here yet" or a bare 404 | M |
| [ ] | CODE-006 | High | CONFIRMED | `setSeatSide` silently does nothing for outings uploaded without a boat name; the UI shows the side as saved, and it is gone on reload | S |
| [ ] | UX-001 | High | CONFIRMED | In-page anchors land in the wrong place because of `content-visibility: auto` placeholders | S |
| [ ] | UX-002 | High | CONFIRMED | Beta form gives no feedback on invalid input until the server round-trip | S |
| [ ] | UX-003 | High | CONFIRMED | 404 page is Next's unstyled default: white page, no header, no footer, no way back | S |
| [ ] | A11Y-001 | High | CONFIRMED | No skip link; keyboard users tab through 7 header controls before reaching content on every page | S |
| [ ] | A11Y-002 | High | CONFIRMED | Login page: "Apply for the beta" link inside a sentence is distinguishable only by colour | S |
| [ ] | PERF-001 | High | CONFIRMED | three.js (249 kB gzip) is downloaded and executed on every /force and /vieve visit, right after hydration | S (intent-gated load) / M (trimming drei) |
| [ ] | PERF-009 | High | CONFIRMED | Query fan-out on the session page: three sequential Supabase round trips per seat, one seat after another | S |
| [ ] | PERF-010 | High | CONFIRMED | Crew page repeats the per-seat serial pattern and serialises up to 20,000 GPS points into the page | S/M |
| [ ] | SEO-001 | High | CONFIRMED | /beta's canonical URL points to the home page, so search engines will treat the beta application page as a duplicate of / | S |
| [ ] | BIZ-002 | High | CONFIRMED | The live headline is jargon that does not say what the product is | S |
| [ ] | BIZ-003 | High | CONFIRMED | "In beta / In development / concept design" saturates the page before any value is stated | S |
| [ ] | BIZ-004 | High | CONFIRMED | Sensor location is non-standard and the site never says what that costs the coach (no oar angle) | S |
| [ ] | BIZ-005 | High | CONFIRMED | "Force" is not yet force: raw sensor units, while the hero screen shows kilograms | M (calibration) / S (caption) |
| [ ] | BIZ-006 | High | CONFIRMED | The headline crew promise ("whose catch is early") depends on Vieve, which does not exist | S |
| [ ] | BIZ-008 | High | CONFIRMED | No price for Force anywhere; the beta "discount" has no anchor | S |
| [ ] | BIZ-010 | High | CONFIRMED | /team was linked and is now a bare 404; company identity is gone from the site | S |
| [ ] | BIZ-011 | High | CONFIRMED | No contact email, no social links, no privacy or terms | S |
| [ ] | BIZ-012 | High | CONFIRMED | Validation and accuracy: nothing to show, and the FAQ says so | M |
| [ ] | BIZ-015 | High | CONFIRMED / SUSPECTED | Trust-signal gap, ranked by conversion impact | M overall |
| [ ] | BIZ-020 | High | SUSPECTED | Time-to-value for a coach who applies today is undefined and probably months | S |
| [ ] | BIZ-022 | High | CONFIRMED | Boat class and rigging compatibility is never stated | S |
| [ ] | SEC-004 | Medium | CONFIRMED | Removing a user from `allowed_users` does not revoke data access — team membership persists and two server actions never check the viewer | S |
| [ ] | SEC-005 | Medium | CONFIRMED | Unbounded zip decompression in the upload path (zip bomb / memory exhaustion on the serverless function) | S |
| [ ] | SEC-006 | Medium | CONFIRMED | No Content-Security-Policy, no X-Frame-Options / frame-ancestors, no X-Content-Type-Options, no Referrer-Policy, no Permissions-Policy on any response | S |
| [ ] | SEC-007 | Medium | CONFIRMED / NEEDS MANUAL CHECK | Open self-registration into Supabase Auth (`shouldCreateUser: true`) with no app-side rate limit or CAPTCHA — account and email spam vector | M |
| [ ] | SEC-008 | Medium | CONFIRMED | No per-user quota on uploads: unbounded sessions, rows, and Storage objects per allowed user | M |
| [ ] | LEG-005 | Medium | CONFIRMED | Anyone can create an account by typing an email; no terms accepted, no notice, no age check | S |
| [ ] | LEG-006 | Medium | CONFIRMED | No data-deletion or export path for anyone: applicants, account holders, coaches' sessions, or athletes | M |
| [ ] | LEG-007 | Medium | CONFIRMED | No business identity, jurisdiction or contact channel anywhere on the site | S |
| [ ] | LEG-008 | Medium | CONFIRMED | Analytics beacons run on every page with no disclosure or consent; PostHog (if enabled later) would set a cookie | S now / M for PostHog |
| [ ] | LEG-009 | Medium | CONFIRMED | Beta promises ("Discounted prices on all RowTech products", "Testing units, for now", "$499 target price") have no terms and contradict the product brief | S |
| [ ] | LEG-010 | Medium | CONFIRMED | Marketing-claims inventory: most claims are hedged well; a handful are absolute or imply on-water validation that the repo does not evidence | S |
| [ ] | LEG-011 | Medium | SUSPECTED | Accessibility as legal exposure (policy level only) | S |
| [ ] | CODE-007 | Medium | CONFIRMED | The only upload E2E test can never sign in: it writes localStorage "sb-auth", which @supabase/ssr never reads | S |
| [ ] | CODE-008 | Medium | SUSPECTED | `teamId()` select-then-insert has no uniqueness guard; concurrent first uploads create two teams and later uploads land in whichever `limit(1)` returns | S |
| [ ] | CODE-009 | Medium | CONFIRMED | `deleteSession` is dead code that is still a publicly callable server action, and it deletes storage before the DB row and ignores every error | S |
| [ ] | CODE-010 | Medium | CONFIRMED | `session_files.upsert` fails silently on every re-upload: the table has no UPDATE policy, and the result is discarded | S |
| [ ] | CODE-011 | Medium | SUSPECTED | CurveCanvas draws one grid line + label per 20 units up to the peak; uncalibrated sessions ("counts") can push that to tens of thousands of draw calls per frame | S |
| [ ] | CODE-012 | Medium | CONFIRMED | Type safety holes: six `as unknown as` casts over Supabase results, no generated DB types, hand-written Row types drifting per page | M |
| [ ] | CODE-013 | Medium | CONFIRMED | Non-null assertions and other checker overrides | S |
| [ ] | CODE-014 | Medium | CONFIRMED | Hand-applied migrations, missing first migration, no CI, no seed, no config.toml, no backup beyond the plan default, no `engines` | M |
| [ ] | CODE-015 | Medium | CONFIRMED | Test coverage: marketing, beta dry-run, login redirect and the pure parser are covered; upload, RLS, auth callback success, delete, cox pages, compare, history chart are not | M |
| [ ] | CODE-016 | Medium | CONFIRMED | Dead code and unused dependencies (knip + manual) | S |
| [ ] | UX-004 | Medium | CONFIRMED | Mobile menu does not behave like a menu: no Escape, no outside-click close, no scroll lock, no focus containment | S |
| [ ] | UX-005 | Medium | CONFIRMED | The beta form cannot be submitted without JavaScript, contrary to the code comment | S |
| [ ] | UX-006 | Medium | NEEDS MANUAL CHECK | After a failed submit the whole form remounts, so focus and scroll position are lost | S |
| [ ] | UX-007 | Medium | CONFIRMED | 3D device stage is an empty grey box with a misleading "Drag the model" hint when the scene is not loaded | S |
| [ ] | UX-008 | Medium | CONFIRMED | Upload form (dashboard): no progress, no cancel for a 25 MB multi-file upload; error text relies on `whitespace-pre-line` | M |
| [ ] | A11Y-003 | Medium | CONFIRMED | 404 page has no landmarks and no useful title | S |
| [ ] | A11Y-004 | Medium | CONFIRMED / SUSPECTED | Mobile menu trigger lacks an explicit button role / expanded state and does not manage focus | S |
| [ ] | A11Y-005 | Medium | CONFIRMED | Touch targets under 44x44 CSS px on mobile | S |
| [ ] | A11Y-006 | Medium | CONFIRMED | Stroke explorer on mobile puts every metric in the tab order twice | S |
| [ ] | PERF-002 | Medium | CONFIRMED | /beta, the conversion page, is dynamically rendered on every request (no CDN cache, a function invocation per hit and per prefetch) | S |
| [ ] | PERF-003 | Medium | CONFIRMED / SUSPECTED | Home page's own JavaScript costs ~2.7 s of CPU on mobile: the hero screen animator runs a 60 fps rAF loop that mutates an inline SVG every frame from hydration onward | S |
| [ ] | PERF-011 | Medium | CONFIRMED | Compare page runs the two pieces one after the other (6 serial queries) and ships two 20,000-point tracks | S |
| [ ] | PERF-012 | Medium | CONFIRMED | /app/force aggregates every stroke the user can see on every visit (session_stats is a plain view over strokes, RLS-checked per row) and loads 200 + 500 rows regardless | M |
| [ ] | PERF-013 | Medium | CONFIRMED | uploadSession is entirely serial: ~12 round trips per seat, 500-row stroke batches one after another, four file uploads one after another | S/M |
| [ ] | SEO-002 | Medium | CONFIRMED | Open Graph and Twitter tags on /beta, /force, /vieve and /app/login are the home page's (title, description and og:url all say home) | S |
| [ ] | SEO-003 | Medium | CONFIRMED | No robots.txt and no sitemap.xml (both 404); /app and /auth are not disallowed for crawlers | S |
| [ ] | SEO-004 | Medium | CONFIRMED / NEEDS MANUAL CHECK | /team now returns 404 with no redirect, after being linked from every page until today; the 404 page is Next's default (two `<title>` elements, no site chrome) | S |
| [ ] | FMT-001 | Medium | CONFIRMED | Mobile menu panel overflows the left edge of a 375px screen by 13px | S |
| [ ] | FMT-002 | Medium | CONFIRMED | Stroke explorer at 375px: marker 7 overlaps the "catch threshold" label | S |
| [ ] | CNT-001 | Medium | CONFIRMED | Hero headline: "imperative data" is a malapropism and "everyone" contradicts the next line; the headline is baked into og.png | S |
| [ ] | CNT-002 | Medium | CONFIRMED | Four words for the same thing: practice, outing, session, piece | S |
| [ ] | CNT-003 | Medium | CONFIRMED | Direct contradictions and promises the UI cannot keep | S |
| [ ] | BIZ-007 | Medium | CONFIRMED | No app, no live coach view: eight WiFi joins and CSV files per outing | S |
| [ ] | BIZ-009 | Medium | CONFIRMED | No pricing page at all; what a competitor's page does that this site does not | S |
| [ ] | BIZ-013 | Medium | CONFIRMED | FAQ: five questions, two of which are non-answers | S |
| [ ] | BIZ-014 | Medium | CONFIRMED | Warranty, support and returns: not mentioned | S |
| [ ] | BIZ-016 | Medium | CONFIRMED | The beta form is good; what happens after it is under-specified | S |
| [ ] | BIZ-017 | Medium | CONFIRMED | The beta offer does not say what the beta is | S |
| [ ] | BIZ-021 | Medium | CONFIRMED | "Coaches first" is stated but the product on the page is athlete-first | S |
| [ ] | BIZ-024 | Medium | CONFIRMED | The site does not use the words coaches search for | S |
| [ ] | BIZ-025 | Medium | CONFIRMED | Vieve competes with NK CoxBox and Coxmate on a spec sheet with no audio, IP rating, hours or harness plan | S |
| [ ] | BIZ-026 | Medium | CONFIRMED | "Two products, one system" sells a system, but only one product exists and the system needs both | S |
| [ ] | BIZ-027 | Medium | SUSPECTED | The site's real differentiators are never stated as claims | S |
| [ ] | SEC-009 | Low | CONFIRMED / NEEDS MANUAL CHECK | Signed Storage URLs (1 h) embedded in the session page leak the team uuid and are shareable with anyone | S |
| [ ] | SEC-010 | Low | CONFIRMED / NEEDS MANUAL CHECK | Supabase auth cookies are set without the `Secure` attribute and without a `__Host-` prefix | S |
| [ ] | SEC-011 | Low | CONFIRMED | HSTS without `includeSubDomains` or `preload` | S |
| [ ] | SEC-012 | Low | CONFIRMED | `X-Powered-By: Next.js` disclosed on dynamic responses | S |
| [ ] | SEC-013 | Low | CONFIRMED | Raw PostgREST/Storage error messages are returned to the user from the upload action | S |
| [ ] | SEC-014 | Low | CONFIRMED | `title` and `boat` lengths (and stroke numeric ranges) are enforced only client-side / by DB CHECKs | S |
| [ ] | SEC-015 | Low | CONFIRMED | Whole `meta.json` is stored verbatim into `sessions.meta` jsonb with no size or shape limit | S |
| [ ] | SEC-016 | Low | CONFIRMED | `deleteSession`: Storage objects are removed before the DB delete, it is dead code (no UI caller), and `id` is not validated | S |
| [ ] | SEC-017 | Low | CONFIRMED | Beta application form: honeypot only — no rate limit, no CAPTCHA, 25 MB request bodies accepted, duplicate submissions silently swallowed | M |
| [ ] | SEC-018 | Low | SUSPECTED | `callbackUrl()` derives the magic-link/OAuth redirect origin from `x-forwarded-host` / `x-forwarded-proto` when `SITE_URL` is unset; `rowtech.vercel.app` is a live alias | S |
| [ ] | SEC-019 | Low | CONFIRMED | `shadcn` CLI is a production dependency, dragging `@modelcontextprotocol/sdk`, `express`, `hono`, `fast-uri`, `qs`, `js-yaml`, `nanoid`… into the prod tree (13 of the 18 audit entries) | S |
| [ ] | SEC-020 | Low | CONFIRMED | No DELETE policy on `teams` or `team_members`, no UPDATE policy on `team_members`; `role` is never enforced by any policy | S |
| [ ] | SEC-021 | Low | CONFIRMED | Unlimited team creation via the API, and a check-then-insert race in `teamId()` that can leave a user in several teams | S |
| [ ] | SEC-022 | Low | CONFIRMED | `Access-Control-Allow-Origin: *` on prerendered pages and the image optimizer | S |
| [ ] | SEC-023 | Low | CONFIRMED | `rowtech.vercel.app` serves the full site including `/app` — a second origin for auth cookies and duplicate content | S |
| [ ] | SEC-024 | Low | NEEDS MANUAL CHECK | No absolute session lifetime: 400-day cookies and no Supabase session time-box/inactivity timeout configured from the repo | S |
| [ ] | SEC-025 | Low | CONFIRMED | `session_files.path` / `strokes` / `gps_points` rows are writable by any member with arbitrary content via PostgREST (data-integrity only; no cross-team read) | S |
| [ ] | SEC-026 | Low | SUSPECTED | `console.error` on the beta path can log applicant PII: Postgres CHECK-violation `details` include the failing row | S |
| [ ] | LEG-012 | Low | SUSPECTED | International applicants are invited, but no controller identity, lawful basis or transfer information is given | S |
| [ ] | LEG-013 | Low | CONFIRMED / SUSPECTED | No age gate or age statement; "Athlete" applicants may be minors | S |
| [ ] | LEG-014 | Low | CONFIRMED | Open-source licences: all permissive, but the served bundles strip every attribution notice | S |
| [ ] | LEG-015 | Low | NEEDS MANUAL CHECK | Ownership of the "Vieve V1 + Force, concept A" concept sheets and the site's derivative renders is undocumented | S |
| [ ] | CODE-017 | Low | CONFIRMED | Duplicated code across the dashboard | S |
| [ ] | CODE-018 | Low | CONFIRMED | Seat 0 is "cox" in the schema, "never set" in the parser, and "seat ?" / `-1` in the pages | S |
| [ ] | CODE-019 | Low | CONFIRMED | Signed curve URLs expire after 1 h; a failed fetch is reported as "The node didn't keep a curve", and there is no retry | S |
| [ ] | CODE-020 | Low | CONFIRMED | Loose multi-file upload cannot represent several seats; the form copy overstates it | S |
| [ ] | CODE-021 | Low | SUSPECTED | Latent infinite loop in CrewPanel when a synced crew has no seats | S |
| [ ] | CODE-022 | Low | CONFIRMED | History chart: `.limit(500)` ascending drops the newest sessions once a team passes 500 seat-sessions; other silent caps | S |
| [ ] | CODE-023 | Low | CONFIRMED | Raw Postgres error strings are shown to coaches | S |
| [ ] | CODE-024 | Low | CONFIRMED | `signup-form` remounts the whole form on every server response; focus and scroll are lost | S |
| [ ] | CODE-025 | Low | CONFIRMED | `getViewer()` and `proxy.ts` ignore auth/RPC errors; a Supabase blip masquerades as "not on the beta list" | S |
| [ ] | CODE-026 | Low | CONFIRMED | `hardware/` (KiCad + `.mcp-backups/`) and an empty `New folder` sit untracked in the web repo | S |
| [ ] | CODE-027 | Low | CONFIRMED | `history-panel` pad maths inverts the axis for an all-negative, all-equal series | S |
| [ ] | CODE-028 | Low | SUSPECTED | PieceMap: degenerate bounds, O(n) hover over 20 k points, unscaled degree distance | S |
| [ ] | CODE-029 | Low | CONFIRMED | N+1 queries and no streaming on the detail pages; three Supabase clients per compare render | S |
| [ ] | CODE-030 | Low | CONFIRMED | `strokes` numeric columns are `real` (float4); CSV export from the DB is not byte-identical to the node's file | S |
| [ ] | CODE-031 | Low | CONFIRMED | `session_stats.span_ms` uses `max(drive_ms)`, not the last stroke's drive | S |
| [ ] | CODE-032 | Low | CONFIRMED | `uploadSession` revalidates only /app/force although it also creates crew rows shown on /app/cox | S |
| [ ] | UX-009 | Low | CONFIRMED | `deleteSession` exists but nothing calls it (no delete UI, so no confirmation question yet) | S |
| [ ] | UX-010 | Low | SUSPECTED | Dashboard timestamps are formatted on the server with `toLocaleString()` | S |
| [ ] | UX-011 | Low | CONFIRMED | Header link labels do not match the section headings they jump to | S |
| [ ] | UX-012 | Low | CONFIRMED | Every "Apply for the beta" variant is a separate dynamic page and is prefetched separately | S |
| [ ] | UX-013 | Low | CONFIRMED | `/favicon.ico` is a 404 | S |
| [ ] | A11Y-007 | Low | CONFIRMED | 3D model stage: focusable `role="group"` with arrow-key behaviour and a `<canvas>` with no accessible name | S |
| [ ] | A11Y-008 | Low | CONFIRMED | Crew-view scroll region is a Tab stop that does nothing on wide screens | S |
| [ ] | A11Y-009 | Low | NEEDS MANUAL CHECK | Colour contrast: axe could not evaluate 105-111 text nodes on `/` (SVG readouts), everything it could evaluate passes | S |
| [ ] | A11Y-010 | Low | SUSPECTED | Honeypot may be autofilled by password managers/browsers, silently discarding real applications | S |
| [ ] | A11Y-011 | Low | CONFIRMED | Pending-state text changes are not announced | S |
| [ ] | PERF-004 | Low | CONFIRMED | Initial JavaScript is 157 kB gzip on / and 163-165 kB on every other page, against the 120 kB target; page-owned share is ~12 kB | S |
| [ ] | PERF-005 | Low | CONFIRMED | Home HTML is 198 kB because the 78 kB of server-rendered markup (44 kB of inline SVG) is serialised a second time in the RSC payload (117 kB across 37 inline scripts) | M |
| [ ] | PERF-006 | Low | CONFIRMED | 116 kB of web fonts are preloaded on every page; the Archivo variable file (wght + wdth) is the largest transfer on every page | S |
| [ ] | PERF-007 | Low | CONFIRMED | Link prefetching fires 13-17 RSC fetches per home visit, including 5 to the dynamic /beta route | S |
| [ ] | PERF-008 | Low | CONFIRMED | `public/` assets (icon.svg, og.png) are served with `max-age=0`, so the favicon is revalidated on every navigation despite its hashed URL | S |
| [ ] | SEO-005 | Low | CONFIRMED | Structured data: the Product on /force cannot earn a rich result (no offers/review/aggregateRating), /vieve has none, and the Organization has no sameAs/contactPoint | S |
| [ ] | SEO-006 | Low | CONFIRMED | Title template mismatch between the site ("%s \| RowTech") and the dashboard ("%s · RowTech"); /vieve title repeats the brand | S |
| [ ] | SEO-007 | Low | CONFIRMED | The home page's only H1 contains none of the terms the page targets | S |
| [ ] | SEO-008 | Low | CONFIRMED | Seven URL variants of /beta are linked internally (`?from=hero\|nav\|stroke\|closing\|login\|force\|vieve`) | S |
| [ ] | FMT-003 | Low | CONFIRMED | Stroke explorer chip grid at 375px leaves "7 Rhythm" orphaned in a row of its own | S |
| [ ] | FMT-004 | Low | CONFIRMED | The 404 page is a white, system-font page on a dark, Archivo-set site | S |
| [ ] | FMT-005 | Low | SUSPECTED | The hero force curve is cut off at the left edge at 375px | S |
| [ ] | CNT-004 | Low | CONFIRMED | Title template separator differs between the site and the dashboard | S |
| [ ] | CNT-005 | Low | CONFIRMED | Straight vs curly apostrophes are mixed across copy; `&rsquo;`, literal `’` and `'` all appear, including side by side on the home page | S |
| [ ] | CNT-006 | Low | CONFIRMED | Terminal-period convention on headings is inconsistent between site and app | S |
| [ ] | CNT-007 | Low | CONFIRMED | Number, unit and label style drifts | S |
| [ ] | CNT-008 | Low | CONFIRMED | "WiFi" should be "Wi-Fi"; other capitalisation conventions are consistent | S |
| [ ] | CNT-009 | Low | CONFIRMED | Error-message inventory: mostly clear and on-voice; a few are misleading, mis-cased or leak raw database text | S |
| [ ] | CNT-010 | Low | CONFIRMED | Synthetic demo session is publicly served but not linked; honesty line on the home page is good | S |
| [ ] | CNT-011 | Low | CONFIRMED | 404 page is Next's default: unbranded, no navigation, duplicate `<title>` | S |
| [ ] | CNT-012 | Low | CONFIRMED | Literal "→" arrow in a link while every other link uses an icon component | S |
| [ ] | CNT-013 | Low | CONFIRMED | Confirmation copy: "Application saved" and first-name greeting edge cases | S |
| [ ] | CNT-014 | Low | CONFIRMED | Dashboard section labels, unknown-seat placeholders, and unpluralised "1 seats" | S |
| [ ] | BIZ-018 | Low | CONFIRMED | Login page and dashboard gate send non-beta users in a loop with no value | S |
| [ ] | BIZ-019 | Low | CONFIRMED | Dashboard empty state assumes hardware the beta user may not have yet | S |
| [ ] | BIZ-028 | Low | CONFIRMED | Stroke-model numbers presented beside "The node measures every stroke like this" | M |
| [ ] | LEAD-001 | Low | CONFIRMED | Supabase Security Advisor: two SECURITY DEFINER functions are executable by every signed-in user | S |
| [ ] | LEAD-002 | Low | CONFIRMED | Supabase default grants: `anon` and `authenticated` hold SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER on every dashboard table; RLS is the only barrier | S |
| [ ] | LEAD-003 | Low | CONFIRMED | Supabase Performance Advisor: three unindexed foreign keys and one per-row `auth.jwt()` evaluation in an RLS policy | S |
| [ ] | LEAD-009 | Low | CONFIRMED | Dashboard stroke list uses `role="listbox"` / `role="option"` with buttons inside the options and a non-focusable listbox | S |
| [ ] | SEC-003 | Info | CLOSED | `beta_signups` RLS state and grants cannot be verified from the repo — if RLS is off or the default `authenticated` grants survive, every self-registered account can read all applicant PII | S |
| [ ] | SEC-027 | Info | CONFIRMED | `setSeatSide` trusts its `side` argument and does not validate `sessionId` at runtime | S |
| [ ] | SEC-028 | Info | CONFIRMED | Storage policy `((storage.foldername(name))[1])::uuid` — behaviour on malformed paths is a hard error (deny), which is fine | S |
| [ ] | SEC-029 | Info | CONFIRMED | What a signed-in but NOT-allowed user can do: nothing beyond seeing their own email — verified against every policy | S |
| [ ] | SEC-030 | Info | CONFIRMED | XSS review: the only two `dangerouslySetInnerHTML` sites inject static JSON-LD; no other sinks | S |
| [ ] | SEC-031 | Info | CONFIRMED | Open-redirect check in `/auth/callback` holds against the usual bypasses | S |
| [ ] | SEC-032 | Info | CONFIRMED | CSRF posture of server actions (including the POST `signOut`) is Next's Origin/Host comparison — adequate | S |
| [ ] | SEC-033 | Info | CONFIRMED | Secrets review: nothing leaked — no keys in history, `.env.local` untracked and Vercel-ignored, no `NEXT_PUBLIC_` misuse, no production source maps | S |
| [ ] | SEC-034 | Info | CONFIRMED | Playwright upload test expects a password-enabled test user on the production Supabase project, and its session hand-off does not match the app's cookie auth | S |
| [ ] | SEC-035 | Info | CONFIRMED | `/team` returns 404 live now (the audit brief recorded 200); CDN cache was stale | S |
| [ ] | SEC-036 | Info | CONFIRMED | Observations with no action needed (bundled Info) | S |
| [ ] | LEG-016 | Info | CONFIRMED | Third-party marks in specs (nominative use) and "WiFi" spelling | S |
| [ ] | LEG-017 | Info | CONFIRMED | Stale-deploy check: `/team` now 404s live and no live page links to it (mismatch resolved); the 404 page is Next's unbranded default with two `<title>` elements | S |
| [ ] | LEG-018 | Info | CONFIRMED | Team name is derived from the user's email; beta duplicates are silently discarded | S |
| [ ] | CODE-033 | Info | CONFIRMED | `proxy.ts` follows the Next 16 convention and the @supabase/ssr pattern (OK) | - |
| [ ] | CODE-034 | Info | CONFIRMED | `experimental.serverActions.bodySizeLimit: "25mb"` and `images.qualities: [75]` are correct for Next 16 | - |
| [ ] | CODE-035 | Info | CONFIRMED | `next-env.d.ts` and `*.tsbuildinfo` are git-ignored, matching the Next 16 docs | - |
| [ ] | CODE-036 | Info | CONFIRMED | Stroke maths reviewed for divide-by-zero / NaN: no defects found | - |
| [ ] | CODE-037 | Info | CONFIRMED | `upload-form` post-success navigation effect is sound | - |
| [ ] | CODE-038 | Info | CONFIRMED | Auth is checked in the (dash) layout; per the Next docs, layouts don't re-run on client navigation, and the two mutating server actions do no viewer check | S |
| [ ] | CODE-039 | Info | CONFIRMED | Server Components format dates with the server's locale and zone | S |
| [ ] | CODE-040 | Info | CONFIRMED | Lint / type-check / test tooling status | S |
| [ ] | CODE-041 | Info | CONFIRMED | `lib/site.ts` origin fallback | - |
| [ ] | CODE-042 | Info | CONFIRMED | `lib/supabase/anon.ts` is not marked `server-only` | S |
| [ ] | CODE-043 | Info | CONFIRMED | Beta submit path error handling is correct; confirmation email is a stub; BETA_DRY_RUN is not guarded in production | S |
| [ ] | UX-014 | Info | CONFIRMED | Title separator differs between the marketing site and the app | S |
| [ ] | UX-015 | Info | CONFIRMED | `/team` mismatch with the audit brief: it is a 404 now, linked from nowhere | S |
| [ ] | UX-016 | Info | CONFIRMED | Performance-adjacent numbers for `/` at 375px (unthrottled connection, from Playwright) | M |
| [ ] | A11Y-012 | Info | CONFIRMED | Positive checks (recorded so they are not re-audited) | - |
| [ ] | PERF-014 | Info | CONFIRMED | `revalidatePath` after uploads/deletes/seat changes cannot purge any server cache because every /app route is dynamic; it only clears the client router cache | - |
| [ ] | PERF-015 | Info | CONFIRMED | content-visibility is still in place; CLS is 0 on every page except a 0.009 shift on /vieve mobile | S |
| [ ] | PERF-016 | Info | CONFIRMED | Caching, compression and redirect behaviour of the prerendered pages (for the record) | - |
| [ ] | PERF-017 | Info | CONFIRMED | Third-party and lazy-chunk hygiene is good: PostHog never loads, maplibre and posthog are separate chunks, Vercel Analytics/Speed Insights are small and same-origin | - |
| [ ] | SEO-009 | Info | CONFIRMED | /app/login is correctly noindex; /beta is indexable (as it should be) but currently canonicalised away | - |
| [ ] | SEO-010 | Info | CONFIRMED | og:image is correct: absolute www host, 1200x630, PNG | - |
| [ ] | SEO-011 | Info | CONFIRMED | Redirects, trailing slashes, hreflang, language (for the record) | - |
| [ ] | SEO-012 | Info | CONFIRMED | Minor head hygiene: no theme-color, apple-touch-icon or web manifest; favicon is SVG only | S |
| [ ] | SEO-013 | Info | CONFIRMED | Accessibility items surfaced by the SEO/perf runs (cross-reference for the a11y auditor) | - |
| [ ] | SEO-014 | Info | NEEDS MANUAL CHECK | Core Web Vitals field data: none available | S |
| [ ] | FMT-006 | Info | CONFIRMED | Full-page screenshots and print/visual-regression tools see blank sections below the fold | S |
| [ ] | FMT-007 | Info | CONFIRMED | No horizontal overflow, no clipped text, consistent gutters (positive) | - |
| [ ] | CNT-015 | Info | CONFIRMED | Header vs footer "beta" destinations differ under similar labels | S |
| [ ] | CNT-016 | Info | CONFIRMED | Oxford comma: consistently omitted (no action) | - |
| [ ] | CNT-017 | Info | CONFIRMED | Register: US audience, UK rowing vocabulary, US spelling in copy, UK spelling in comments | - |
| [ ] | CNT-018 | Info | CONFIRMED | `lib/stroke.ts` EXAMPLE constants disagree with the numbers the page computes (maintenance hazard, not user-facing) | S |
| [ ] | CNT-019 | Info | CONFIRMED | Product brief (`PRODUCT.md`) has drifted from the site | S |
| [ ] | CNT-020 | Info | CONFIRMED | Metadata copy check (per page) | S |
| [ ] | CNT-021 | Info | CONFIRMED | Vieve page: pricing sentence in the hero lead | S |
| [ ] | CNT-022 | Info | CONFIRMED | Copyright line and footer | - |
| [ ] | BIZ-029 | Info | CONFIRMED | Share-preview copy is clearer than the page it lands on | S |
| [ ] | BIZ-030 | Info | SUSPECTED | Quick wins ranked by expected effect on beta applications | S |
| [ ] | LEAD-004 | Info | CONFIRMED | The live schema confirms CODE-001, CODE-010 and CODE-014 | S |
| [ ] | LEAD-005 | Info | CONFIRMED | `beta_signups` is protected as the README claims, and duplicates are de-duplicated by a unique index on `lower(email)` | S |
| [ ] | LEAD-006 | Info | CONFIRMED / NEEDS MANUAL CHECK | Vercel: production environment variables could not be listed; preview deployments are protected; `rowtech.vercel.app` is a public second origin | S |
| [ ] | LEAD-007 | Info | CONFIRMED | The hero's stroke counter increments forever while visible, drifting away from the "Example stroke 147" the rest of the page quotes | S |
| [ ] | LEAD-008 | Info | SUSPECTED | The hero curve strip animates `clip-path` on a full-width SVG at 60 fps, in addition to the JavaScript animator | S |
| [ ] | LEAD-010 | Info | CONFIRMED | Arrow keys are captured by the 3D stage and the stroke explorer marker buttons hover-activate on pointer entry | S |

---

## 5. What I couldn't check

Grouped by what would unblock it.

### Needs a real login (the ground rules forbade submitting the login form or the beta form)
- Live cookie attributes on `sb-*-auth-token*` (Secure, HttpOnly, SameSite, Max-Age); the library defaults are documented in SEC-010. Safe test: sign in as the owner on a preview deployment, open DevTools > Application > Cookies.
- Everything behind `/app`: the upload form, session viewer, history chart, cox pages and compare page were reviewed from source and from the production build's markup only. Safe test: `BETA_DRY_RUN=1 npm run build && npm start` locally with a local Supabase (`supabase start`) and a seeded `allowed_users` row.
- Whether a real upload succeeds (CODE-001), whether re-upload duplicates crew parents (CODE-004), whether the port/starboard buttons persist (CODE-006), the signed-URL expiry behaviour (CODE-019). Safe test: one upload of `public/demo/seat-1` on a Supabase branch database, never on production.
- The beta form's success screen, server-side error rendering, focus handling after an error (UX-006), the honeypot behaviour and the double-submit guard. Safe test: the Playwright suite already covers the happy and error paths with `BETA_DRY_RUN=1`.
- Live confirmation of SEC-001 (joining a foreign team) and SEC-004 (revoked user keeps access). Safe test: two test users on a Supabase branch; never on production.

### Needs a console the audit could not reach
- Vercel: production environment variables (`SITE_URL`, `BETA_DRY_RUN`, `NEXT_PUBLIC_POSTHOG_KEY`) — the API returned 403. Function region and `maxDuration`. Web Analytics / Speed Insights data retention. Real-user vitals (Speed Insights dashboard).
- Supabase Auth settings: custom SMTP configured or not (if not, magic links only reach the project's own team members), OTP and email rate limits, CAPTCHA, redirect URL allow-list, secure email change, session time-box and inactivity timeout, whether the Google provider is enabled. Supabase plan, backups and PITR. Supabase DPA acceptance.
- Google Cloud Console: OAuth consent screen state (Testing vs Production), verification status, configured privacy-policy URL.
- Google Search Console: whether `/team` was indexed, crawl errors, sitemap status.

### Needs tooling or data that was unavailable
- PageSpeed Insights and CrUX field data: every keyless call returned 429 with a daily quota of 0. Lighthouse was run locally instead (Windows workstation; mobile LCP is machine-bound at about 2.7 s, desktop numbers are reliable). Re-run PSI with an API key for authoritative mobile scores.
- `EXPLAIN ANALYZE` on `session_stats` and the per-row RLS cost (PERF-012); no query plans were run.
- Real HX711 count magnitudes on an uncalibrated node (CODE-011 severity depends on it); the firmware lives in another repository, so "80 samples a second", the catch threshold and the file format were not verified against source.
- Real devices and screen readers (iOS Safari, Android Chrome, VoiceOver, NVDA, TalkBack): only headless Chromium with axe-core and ARIA snapshots. Firefox and WebKit were not run; `<details>`-based menus and `content-visibility` behave differently there.
- Colour contrast of SVG `<text>` inside the device illustrations (axe reported 105-111 "incomplete" nodes on `/`); DOM text passed an automated sweep.
- Tablet (768 px) was screenshotted and overflow-checked but not axe-scanned or keyboard-walked.
- Peach Innovations' own website (TLS handshake failed twice); Peach facts come from Rowing News and a 2021 Frontiers paper.
- Trademark status of "RowTech", "Vieve" and "Force"; ownership of the "Vieve V1 + Force, concept A" concept sheets.
- Whether a Force node has ever recorded a real on-water session (bears on "What the rower sees on the water" and the hero's kg readouts).
- Actual beta reply time, selection criteria, crew count, shipping geography: not on the site, not in the repo.
- Contents of `beta_signups` rows and `auth.users` (row-level reads were declined by policy; only counts were used).
- Print stylesheet; HTTP `TRACE`; HTTP/2-specific behaviour on Vercel.

### Out of scope by design
- The firmware repository and the hardware KiCad project (`hardware/`, untracked in this repo).
- Load testing, fuzzing, brute force, and any write against the live site or database.

---

## 6. Final read-through: what the second pass added

After the specialist passes, every file under `app/`, `components/`, `lib/`, `scripts/`, `tests/`, `app/globals.css` and the migrations was read once more. The second pass added LEAD-007 (hero stroke counter drift), LEAD-008 (CSS clip-path animation cost), LEAD-009 (listbox/option ARIA misuse in the stroke list) and LEAD-010 (arrow-key capture and hover activation), confirmed CODE-001, CODE-010 and CODE-014 against the live schema (LEAD-004), closed SEC-003 (LEAD-005), and closed the preview-protection question in SEC-023 (LEAD-006). No secrets, no additional injection sinks and no further authorisation gaps were found.

Positives worth keeping, so nobody "fixes" them: server-only Supabase keys with no browser client; RLS on every table with `security definer` helpers that set an empty `search_path`; strict, well-messaged session-file parsing; a beta form with three required fields, proper label wiring and a working honeypot; reduced-motion support everywhere; visible focus rings on every tab stop; one `h1` per page with clean heading order; self-hosted fonts; no third-party scripts; a prerendered, CDN-cached marketing site with CLS 0; and honest "concept design" / "made-up sample session" copy.

