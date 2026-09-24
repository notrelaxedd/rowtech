import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { zipSync } from "fflate";
import { hasAccount, localSupabaseMissing, makeUser, signInBrowser } from "./support/local-supabase";

test("the dashboard is closed to people who aren't signed in", async ({ page }) => {
  await page.goto("/app/force");
  await expect(page).toHaveURL(/\/app\/login/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sign in");
  await expect(page.getByRole("link", { name: /apply for the beta/i })).toBeVisible();
});

test("a stale magic link says so instead of failing quietly", async ({ page }) => {
  await page.goto("/auth/callback");
  await expect(page).toHaveURL(/\/app\/login\?error=link/);
  await expect(page.getByRole("alert").first()).toContainText(/expired|already used/i);
});

test.describe("signing in", () => {
  test.skip(!!localSupabaseMissing, localSupabaseMissing ?? "");

  test("an address with no account gets the same reply, and no account is made", async ({ page }) => {
    const email = `nobody-${Date.now()}@example.com`;
    await page.goto("/app/login");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: /email me a link/i }).click();
    await expect(page.getByRole("heading", { name: "Check your email." })).toBeVisible();
    expect(await hasAccount(email)).toBe(false);
  });
});

// Uploading needs a signed-in beta account, so these run against a local
// Supabase (see README, "Tests"). Each test makes its own user; nothing here
// can reach the production project (tests/support/local-supabase.ts).
test.describe("signed in", () => {
  test.skip(!!localSupabaseMissing, localSupabaseMissing ?? "");

  const seatFiles = (n: number) =>
    ["meta.json", "strokes.csv", "curves.bin", "events.csv"].map((f) => `public/demo/seat-${n}/${f}`);

  async function crewZip(...seats: number[]) {
    const entries: Record<string, Uint8Array> = {};
    for (const n of seats) {
      for (const f of ["meta.json", "strokes.csv", "curves.bin", "events.csv"]) {
        entries[`outing/seat-${n}/${f}`] = new Uint8Array(await readFile(`public/demo/seat-${n}/${f}`));
      }
    }
    return { name: "outing.zip", mimeType: "application/zip", buffer: Buffer.from(zipSync(entries)) };
  }

  async function upload(page: Page, files: Parameters<Page["setInputFiles"]>[1]) {
    await page.goto("/app/force");
    await page.getByLabel("Files").setInputFiles(files);
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page).toHaveURL(/\/app\/force\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    return page.url().split("/").pop()!;
  }

  test("an uploaded sample session renders in /app/force, and uploading it again doesn't double it", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);

    const first = await upload(page, seatFiles(1));
    await expect(page.getByRole("slider", { name: "Stroke" })).toBeVisible();
    await expect(page.getByRole("img", { name: /Force curve for stroke 1/ })).toBeVisible();

    // The same session again lands on the same row, with its strokes replaced.
    expect(await upload(page, seatFiles(1))).toBe(first);
    const { data: sessions } = await user.db.from("sessions").select("id, stroke_count");
    expect(sessions).toEqual([{ id: first, stroke_count: 147 }]);
    const { count } = await user.db.from("strokes").select("*", { count: "exact", head: true });
    expect(count).toBe(147);
  });

  test("seats uploaded together become one crew outing, and uploading it again keeps one", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);

    const crew = await upload(page, await crewZip(2, 6));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("2 seats");
    expect(await upload(page, await crewZip(2, 6))).toBe(crew);

    const { data: rows } = await user.db.from("sessions").select("id, kind, parent_id");
    expect(rows?.filter((r) => r.kind === "crew").map((r) => r.id)).toEqual([crew]);
    expect(rows?.filter((r) => r.kind === "node").every((r) => r.parent_id === crew)).toBe(true);
    expect(rows).toHaveLength(3);
  });

  test("an upload bigger than any outing is refused, and says why", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    await page.goto("/app/force");
    const tooMany = Array.from({ length: 37 }, (_, i) => ({ name: `f${i}.csv`, mimeType: "text/csv", buffer: Buffer.from("x") }));
    await page.getByLabel("Files").setInputFiles(tooMany);
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByText(/more files than one upload takes/)).toBeVisible();
  });

  test("port and starboard stay set on an outing with no boat", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const crew = await upload(page, await crewZip(2, 6));

    await page.goto(`/app/cox/${crew}`);
    const seat2 = page.getByRole("listitem").filter({ hasText: "seat 2" }).filter({ has: page.getByRole("button", { name: "P" }) });
    const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes(`/app/cox/${crew}`));
    await seat2.getByRole("button", { name: "P" }).click();
    await saved;

    await page.reload();
    await expect(seat2.getByRole("button", { name: "P" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/wasn.t saved/)).toHaveCount(0);
  });
});
