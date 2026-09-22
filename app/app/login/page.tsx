import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/server";
import { Logo } from "@/components/site/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await getViewer();
  if (viewer.state === "allowed") redirect("/app");

  const q = await searchParams;
  const failed = q.error === "link" ? "That link has expired or was already used. Here's a fresh one." : q.error === "google" ? "Google sign-in didn't come back. Try again, or use a link instead." : "";

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" aria-label="RowTech home" className="inline-block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-trace">
          <Logo />
        </Link>
        <h1 className="type-h2 mt-8 text-[2rem]">Sign in</h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
          The RowTech dashboard is for beta crews.{" "}
          <Link href="/beta?from=login" data-cta="login" className="text-trace underline-offset-4 hover:underline">
            Apply for the beta
          </Link>{" "}
          if you&rsquo;re not in yet.
        </p>
        <div className="mt-8">
          <LoginForm error={failed} />
        </div>
      </div>
    </main>
  );
}
