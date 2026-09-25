import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/** Server-side client on the publishable key. In project "rowtech" that key can
 *  INSERT into public.beta_signups and nothing else (RLS + column grants). */
export function supabaseAnon() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
