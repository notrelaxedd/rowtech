// A Supabase that is half down, in front of the local one, for
// tests/outage.spec.ts. Auth passes through, so a browser signed in on the
// local Supabase is signed in here too. Then:
// - Auth's health check fails, so /api/health has something to report;
// - the beta-list check works and every other database or Storage call
//   fails: the dashboard's header renders and its pages can't.
import http from "node:http";

const upstream = new URL(process.env.UPSTREAM_SUPABASE_URL ?? "http://127.0.0.1:54321");
const port = Number(process.env.PORT ?? 3212);

function fails(req) {
  const path = req.url ?? "";
  if (path.startsWith("/auth/v1/health")) return true;
  if (path.startsWith("/auth/")) return false;
  return !path.startsWith("/rest/v1/rpc/is_beta_user");
}

http
  .createServer((req, res) => {
    if (fails(req)) {
      // 500 rather than 503: supabase-js retries a 503, which only slows the tests.
      res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ message: "simulated outage" }));
      return;
    }
    const out = http.request(
      { host: upstream.hostname, port: upstream.port, path: req.url, method: req.method, headers: { ...req.headers, host: upstream.host } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    out.on("error", () => res.writeHead(502).end());
    req.pipe(out);
  })
  .listen(port, "127.0.0.1");
