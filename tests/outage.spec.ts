// The site with Supabase half down (tests/support/supabase-outage.mjs): a
// failed read says the page didn't load, instead of showing an empty
// dashboard, a 404 or "apply for the beta".
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { makeUser, outage, signInBrowser } from "./support/local-supabase";

test.skip(!outage, "needs a local Supabase (tests/support/local-supabase.ts)");
test.use({ baseURL: outage?.app });

test("/api/health answers 503 when Supabase doesn't", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(503);
  expect(res.headers()["cache-control"]).toBe("no-store");
  expect(await res.json()).toEqual({ ok: false });
});

test("signed out, the dashboard still sends you to sign in", async ({ page }) => {
  await page.goto("/app/force");
  await expect(page).toHaveURL(/\/app\/login/);
});

test("a failed read shows an error inside the dashboard, not an empty one", async ({ page, context }) => {
  const user = await makeUser();
  await signInBrowser(context, user, outage!.app);

  await page.goto("/app/force");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page didn’t load.");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page.getByText(/Nothing here yet/)).toHaveCount(0);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page didn’t load.");

  await page.goto("/app/cox");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page didn’t load.");
  await expect(page.getByText(/No crew outings yet/)).toHaveCount(0);

  // A session that can't be read is not a session that isn't there.
  await page.goto(`/app/force/${randomUUID()}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page didn’t load.");
});

test("when Storage doesn't answer, a session page says it didn't load instead of showing no curve", async ({ page, context }, info) => {
  const user = await makeUser({ prefix: "storage-down" });
  // Uploaded through the site that works; the session cookie is the same on both.
  const site = info.project.use.baseURL!;
  await signInBrowser(context, user, site);
  await page.goto(`${site}/app/force`);
  await page.getByLabel("Files").setInputFiles(["meta.json", "strokes.csv", "curves.bin", "events.csv"].map((f) => `public/demo/seat-1/${f}`));
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page).toHaveURL(/\/app\/force\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const id = page.url().split("/").pop()!;

  await page.goto(`/app/force/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page didn’t load.");
});

test("when the beta list can't be checked, it says so instead of asking you to apply", async ({ page, context }) => {
  const user = await makeUser({ prefix: "db-down" });
  await signInBrowser(context, user, outage!.app);

  await page.goto("/app/force");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Something went wrong.");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByText(/beta list/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /apply for the beta/i })).toHaveCount(0);
});

test("when Supabase Auth can't say who you are, it says so instead of signing you out", async ({ page, context }) => {
  const user = await makeUser({ prefix: "auth-down" });
  await signInBrowser(context, user, outage!.app);

  await page.goto("/app/force");
  await expect(page).toHaveURL(/\/app\/force$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Something went wrong.");
});
