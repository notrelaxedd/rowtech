import { test, expect } from "@playwright/test";

test("the dashboard is closed to people who aren't signed in", async ({ page }) => {
  await page.goto("/app/force");
  await expect(page).toHaveURL(/\/app\/login/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sign in");
  await expect(page.getByRole("link", { name: /apply for the beta/i })).toBeVisible();
});

test("sign in is an email and a password", async ({ page }) => {
  await page.goto("/app/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: /email me a link/i })).toHaveCount(0);
});

test("sign in checks the form before asking Supabase", async ({ page }) => {
  await page.goto("/app/login");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password").fill("x");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /email address/i })).toBeVisible();

  await page.getByLabel("Email").fill("crew@example.com");
  await page.getByLabel("Password").fill("");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /enter your password/i })).toBeVisible();
});

test("a stale magic link says so instead of failing quietly", async ({ page }) => {
  await page.goto("/auth/callback");
  await expect(page).toHaveURL(/\/app\/login\?error=link/);
  await expect(page.getByRole("alert").first()).toContainText(/expired|already used/i);
});

// Uploading needs a signed-in beta account, which CI doesn't have. Set
// TEST_USER_EMAIL and TEST_USER_PASSWORD (a user on allowed_users, with
// password sign-in enabled in Supabase) to run it.
const email = process.env.TEST_USER_EMAIL;
const password = process.env.TEST_USER_PASSWORD;

test.describe("signed in", () => {
  test.skip(!email || !password, "set TEST_USER_EMAIL and TEST_USER_PASSWORD to run the upload test");

  test("an uploaded sample session renders in /app/force", async ({ page, request }) => {
    const base = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    test.skip(!base || !key, "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set");

    // Sign in through Supabase directly, then hand the session to the app.
    const res = await request.post(`${base}/auth/v1/token?grant_type=password`, {
      headers: { apikey: key!, "Content-Type": "application/json" },
      data: { email, password },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { access_token: string; refresh_token: string };

    await page.goto("/app/login");
    await page.evaluate(
      ([a, r]) => localStorage.setItem("sb-auth", JSON.stringify({ access_token: a, refresh_token: r })),
      [body.access_token, body.refresh_token]
    );

    await page.goto("/app/force");
    await page.getByLabel("Files").setInputFiles([
      "public/demo/seat-1/meta.json",
      "public/demo/seat-1/strokes.csv",
      "public/demo/seat-1/curves.bin",
      "public/demo/seat-1/events.csv",
    ]);
    await page.getByRole("button", { name: "Upload" }).click();

    await expect(page.getByRole("slider", { name: "Stroke" })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("img", { name: /Force curve for stroke 1/ })).toBeVisible();
  });
});
