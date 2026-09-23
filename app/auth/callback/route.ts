import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Where magic links and Google land. Swaps the code for a session, then sends
// the visitor on. `next` is kept relative so it can't bounce off-site.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const raw = searchParams.get("next") ?? "/app";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app";

  if (!code) return NextResponse.redirect(`${origin}/app/login?error=link`);

  const sb = await supabaseServer();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/app/login?error=link`);
  return NextResponse.redirect(`${origin}${next}`);
}
