// A local Supabase (`npx supabase start`) for the tests that need a signed-in
// user. These tests create users and write rows, so they refuse to run
// against anything but this machine unless TEST_SUPABASE_ALLOW_REMOTE=1 (for
// a throwaway Supabase branch database). Never point them at production.
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import type { BrowserContext } from "@playwright/test";

const url = process.env.SUPABASE_URL ?? "";
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
// The local stack's secret (service role) key, printed by `npx supabase start`.
// Test-only: the app never reads it, and it must never be set on Vercel.
const secret = process.env.SUPABASE_SECRET_KEY ?? "";

function isLocal(u: string) {
  try {
    return ["127.0.0.1", "localhost"].includes(new URL(u).hostname);
  } catch {
    return false;
  }
}

/** Why the signed-in tests can't run here, or null when they can. */
export const localSupabaseMissing: string | null =
  !url || !publishable || !secret
    ? "set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY from `npx supabase start` to run the signed-in tests"
    : !isLocal(url) && process.env.TEST_SUPABASE_ALLOW_REMOTE !== "1"
      ? "SUPABASE_URL isn't a local Supabase; the signed-in tests only write to one"
      : null;

/**
 * A second server on the same build, in front of a half-down Supabase
 * (supabase-outage.mjs), for tests/outage.spec.ts. Local Supabase only: the
 * app's session cookie is named after Supabase's host, so the stand-in has to
 * share it.
 */
export const outage =
  localSupabaseMissing || !isLocal(url) ? null : { app: "http://localhost:3211", supabase: `http://${new URL(url).hostname}:3212` };

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = () => createClient(url, secret, noSession);

export type TestUser = { id: string; email: string; password: string; db: SupabaseClient };

/** A fresh user with a password, signed in, and on the beta list unless told otherwise. */
export async function makeUser({ allowed = true, prefix = "test" }: { allowed?: boolean; prefix?: string } = {}): Promise<TestUser> {
  const email = `${prefix}-${randomUUID()}@example.com`;
  const password = randomUUID();
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("no user created");
  if (allowed) await allow(email);

  const db = createClient(url, publishable, noSession);
  const { error: signInError } = await db.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, password, db };
}

export async function allow(email: string) {
  const { error } = await admin().from("allowed_users").insert({ email });
  if (error) throw error;
}

/** Adds someone to a team by hand, as README says members are added for now. */
export async function addToTeam(team: string, user: TestUser, role: "owner" | "coach" | "member") {
  const { error } = await admin().from("team_members").insert({ team_id: team, user_id: user.id, role });
  if (error) throw error;
}

/** Whether Supabase Auth has an account for this address. */
export async function hasAccount(email: string) {
  const { data, error } = await admin().auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.some((u) => u.email === email);
}

/** Takes someone off the beta list, as README says to. */
export async function revoke(email: string) {
  const { error } = await admin().from("allowed_users").delete().eq("email", email);
  if (error) throw error;
}

/**
 * Signs the browser in the way the app does it: the session cookies that
 * @supabase/ssr writes and the app's server client reads.
 */
export async function signInBrowser(context: BrowserContext, user: TestUser, baseURL: string) {
  const jar = new Map<string, string>();
  const sb = createServerClient(url, publishable, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => {
        for (const { name, value } of list) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  const { error } = await sb.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  // The cookies are written from the client's auth event; give it a moment.
  for (let i = 0; i < 50 && ![...jar.keys()].some((k) => k.includes("-auth-token")); i++) {
    await new Promise((r) => setTimeout(r, 20));
  }
  if (!jar.size) throw new Error("signing in wrote no session cookies");
  await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: baseURL })));
}
