// For an uptime monitor: 200 when Supabase answers, 503 when it doesn't. The
// publishable key can't read the dashboard tables, so this asks Supabase Auth's
// own health endpoint, which the dashboard needs first anyway. Never cached,
// and the body says up or down, nothing more.
const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  let ok = false;
  if (url && key) {
    try {
      const res = await fetch(`${url}/auth/v1/health`, {
        headers: { apikey: key },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      ok = res.ok;
    } catch {
      // Unreachable or too slow: down.
    }
  }
  return Response.json({ ok }, { status: ok ? 200 : 503, headers: noStore });
}
