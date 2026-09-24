"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { EMAIL } from "@/app/beta/fields";
import { siteUrl } from "@/lib/site";

export type LoginState = { status: "idle" | "error" | "sent"; message: string; email: string };

/**
 * Where magic links and Google send people back to. Always the configured
 * site, never the request's own Host headers: every alias of a deployment is
 * a valid Host, and a sign-in that starts on one origin can't finish on
 * another (the PKCE verifier cookie stays behind).
 */
function callbackUrl(next: string) {
  return `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;
}

/**
 * Magic link, for people who already have an account: accounts are made by
 * hand when someone is let into the beta (README, "Dashboard access"), so
 * typing an address here never creates one. The reply is the same whether or
 * not the address has an account, so the form doesn't reveal who does.
 */
export async function sendMagicLink(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const email = (fd.get("email") as string | null)?.trim().toLowerCase() ?? "";
  if (!email || !EMAIL.test(email)) return { status: "error", message: "That doesn't look like an email address.", email };

  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl("/app"), shouldCreateUser: false },
  });
  // otp_disabled: no account for this address. Nothing is sent; say the same.
  if (error && error.code !== "otp_disabled") {
    console.error("magic link failed", error);
    return { status: "error", message: "We couldn't send that link. Try again in a minute.", email };
  }
  return { status: "sent", message: "", email };
}

export async function signInWithGoogle() {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl("/app") },
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
