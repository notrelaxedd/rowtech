import type { Instrumentation } from "next";

// One line in the function logs for every server error Next catches (a page,
// a route handler, an action, the proxy), with the digest the error page shows
// as its reference. The path only: a query can carry a sign-in code, and the
// headers carry the session cookies.
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  console.error("request failed", {
    method: request.method,
    path: request.path.split("?")[0],
    route: context.routePath,
    type: context.routeType,
    digest: typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined,
    message: err instanceof Error ? err.message : String(err),
  });
};
