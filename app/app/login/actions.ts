"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { EMAIL } from "@/app/beta/fields";

export type LoginState = { status: "idle" | "error"; message: string; email: string };

async function callbackUrl(next: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = process.env.SITE_URL || `${proto}://${host}`;
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

/**
 * Email and password. A wrong email and a wrong password get the same reply, so
 * the form can't be used to find out who has an account. Getting in here only
 * makes a session; /app still checks allowed_users.
 */
export async function signInWithPassword(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const email = (fd.get("email") as string | null)?.trim().toLowerCase() ?? "";
  const password = (fd.get("password") as string | null) ?? "";
  if (!email || !EMAIL.test(email)) return { status: "error", message: "That doesn't look like an email address.", email };
  if (!password) return { status: "error", message: "Enter your password.", email };

  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "invalid_credentials") return { status: "error", message: "That email and password don't match.", email };
    console.error("password sign-in failed", error);
    return { status: "error", message: "We couldn't sign you in. Try again in a minute.", email };
  }
  redirect("/app");
}

export async function signInWithGoogle() {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await callbackUrl("/app") },
  });
  if (error || !data.url) {
    console.error("google sign-in failed", error);
    redirect("/app/login?error=google");
  }
  redirect(data.url);
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/app/login");
}
