import type { CookieOptions } from "@supabase/ssr";

/**
 * The Supabase session cookies. HttpOnly: only the server reads them (this app
 * has no browser Supabase client). Secure wherever the site is served over
 * HTTPS, i.e. every build but `next dev`.
 */
export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

/**
 * How long a session cookie lives without a visit. Every visit to /app
 * refreshes it, so this signs out a device that hasn't been used in a month
 * rather than one in use. @supabase/ssr always asks for 400 days, so it is
 * capped here, where the cookies are written.
 */
const MAX_AGE = 30 * 24 * 60 * 60;

export function withSessionLifetime(options: CookieOptions): CookieOptions {
  // maxAge 0 is how a cookie is deleted; leave that alone.
  if (options.maxAge === 0) return options;
  return { ...options, maxAge: Math.min(options.maxAge ?? MAX_AGE, MAX_AGE) };
}
