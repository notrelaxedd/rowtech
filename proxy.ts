import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions, withSessionLifetime } from "@/lib/supabase/cookies";

// Keeps the Supabase session fresh for the dashboard. Only /app and /auth run
// through here; the marketing site and /beta never touch it. Authorisation is
// not done here -- /app's layout and RLS do that.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const sb = createServerClient(url, key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, withSessionLifetime(options));
      },
    },
  });
  // Touching the user refreshes an expiring session and writes new cookies.
  await sb.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/app/:path*", "/auth/:path*"],
};
