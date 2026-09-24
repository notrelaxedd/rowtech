import "server-only";
import { createServerClient } from "@supabase/ssr";
import { isAuthApiError, isAuthSessionMissingError, type AuthError } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authCookieOptions, withSessionLifetime } from "./cookies";

function env() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set");
  return { url, key };
}

/**
 * Supabase as the signed-in user, for Server Components, Server Actions and
 * Route Handlers. The session lives in cookies; RLS does the authorisation.
 * Server Components can't set cookies -- the proxy refreshes the session
 * before they run, so the failed write there is expected and ignored.
 */
export async function supabaseServer() {
  const { url, key } = env();
  const jar = await cookies();
  return createServerClient(url, key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, withSessionLifetime(options));
        } catch {
          // Called from a Server Component: the proxy has this covered.
        }
      },
    },
  });
}

/**
 * For page reads: a failed query throws, so the nearest error.tsx says the
 * page didn't load instead of it rendering as if there were nothing there.
 * Only the code and message go into the error (and the logs), never details.
 *
 * Signed out, a read is refused too (anon holds nothing on the dashboard's
 * tables, 42501; a token PostgREST won't take, PGRST30x). The layout's check
 * doesn't re-run when someone clicks between dashboard pages, so a session
 * that ended in another tab shows up here first: that goes to sign in.
 */
export async function readFailed(error: { code?: string; message: string }) {
  if ((error.code === "42501" || error.code?.startsWith("PGRST30")) && (await getViewer()).state === "signed-out") redirect("/app/login");
  return new Error(`Supabase read failed: ${error.code || "no code"} ${error.message}`);
}

export type Viewer =
  | { state: "signed-out" }
  | { state: "not-allowed"; email: string }
  | { state: "allowed"; email: string; id: string }
  // Supabase didn't answer, so there is no telling who this is.
  | { state: "error" };

/** Auth's way of saying there is no session, or none it still honours. */
const noSession = (e: AuthError) =>
  isAuthSessionMissingError(e) || (isAuthApiError(e) && e.status >= 400 && e.status < 500 && e.status !== 429);

/** Who is looking at /app, and whether they are on the beta list. */
export async function getViewer(): Promise<Viewer> {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  if (error && !noSession(error)) {
    console.error("viewer: auth failed", { code: error.code, status: error.status, message: error.message });
    return { state: "error" };
  }
  const user = data.user;
  if (!user?.email) return { state: "signed-out" };
  const { data: ok, error: rpcError } = await sb.rpc("is_beta_user");
  if (rpcError) {
    console.error("viewer: beta check failed", { code: rpcError.code, message: rpcError.message });
    return { state: "error" };
  }
  return ok === true ? { state: "allowed", email: user.email, id: user.id } : { state: "not-allowed", email: user.email };
}
