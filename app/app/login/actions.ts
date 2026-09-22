"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { EMAIL } from "@/app/beta/fields";

export type LoginState = { status: "idle" | "error" | "sent"; message: string; email: string };

async function callbackUrl(next: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = process.env.SITE_URL || `${proto}://${host}`;
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

/** Magic link. The reply is the same whether or not the address is known. */
export async function sendMagicLink(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const email = (fd.get("email") as string | null)?.trim().toLowerCase() ?? "";
  if (!email || !EMAIL.test(email)) return { status: "error", message: "That doesn't look like an email address.", email };

  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: await callbackUrl("/app"), shouldCreateUser: true },
  });
  if (error) {
    console.error("magic link failed", error);
    return { status: "error", message: "We couldn't send that link. Try again in a minute.", email };
  }
  return { status: "sent", message: "", email };
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
