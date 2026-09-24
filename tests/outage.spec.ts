// The site with Supabase half down (tests/support/supabase-outage.mjs): a
// failed read says the page didn't load, instead of showing an empty
// dashboard or a 404.
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
