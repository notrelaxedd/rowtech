import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
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

test("/api/health answers 200 when Supabase does, and is never cached", async ({ request }) => {
  test.skip(!!localSupabaseMissing, localSupabaseMissing ?? "");
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toBe("no-store");
  expect(await res.json()).toEqual({ ok: true });
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

  /** Seat n's demo session, stretched to `strokes` strokes (with curves), as a new session. */
  async function longSeat(n: number, strokes: number) {
    const [meta, csv, curves] = await Promise.all(
      ["meta.json", "strokes.csv", "curves.bin"].map((f) => readFile(`public/demo/seat-${n}/${f}`))
    );
    const [header, ...rows] = csv.toString().trim().split("\n");
    const lines = [header];
    const curveBytes = new Uint8Array(strokes * 128);
    for (let i = 0; i < strokes; i++) {
      const p = rows[i % rows.length].split(",");
      p[0] = String(i); // rec
      p[1] = String(i + 1); // seq
      p[2] = String(40_000 + i * 2_100); // catch_ms
      lines.push(p.join(","));
      const from = (i % rows.length) * 128;
      curveBytes.set(curves.subarray(from, from + 128), i * 128);
    }
    const m = { ...JSON.parse(meta.toString()), uuid: randomUUID(), strokes };
    return {
      "meta.json": new TextEncoder().encode(JSON.stringify(m)),
      "strokes.csv": new TextEncoder().encode(lines.join("\n") + "\n"),
      "curves.bin": curveBytes,
    };
  }

  // The API stops a table read at 1,000 rows; a long practice is ~2,000
  // strokes a seat, and a GPS track is 10 fixes a second.
  test("every stroke of a long session shows, and the whole track reaches the map", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const entries: Record<string, Uint8Array> = {};
    for (const [n, strokes] of [[2, 1500], [6, 1200]]) {
      for (const [f, bytes] of Object.entries(await longSeat(n, strokes))) entries[`outing/seat-${n}/${f}`] = bytes;
    }
    const crew = await upload(page, { name: "outing.zip", mimeType: "application/zip", buffer: Buffer.from(zipSync(entries)) });

    // The header is sent first, and the strokes stream in after it.
    expect(await (await page.request.get(`/app/force/${crew}`)).text()).toContain("Loading strokes…");

    const slider = page.getByRole("slider", { name: "Stroke" });
    await expect(slider).toHaveAttribute("aria-valuemax", "1500");
    await expect(page.getByRole("img", { name: /Force curve for stroke 1/ })).toBeVisible();
    await page.getByRole("button", { name: "seat 6" }).click();
    await expect(slider).toHaveAttribute("aria-valuemax", "1200");
    await slider.press("End");
    await expect(slider).toHaveAttribute("aria-valuetext", "Stroke 1200 of 1200");

    // A 5-minute track at 10 Hz: 3,000 fixes, thinned for the page but still
    // running to the last one.
    const fixes = Array.from({ length: 3000 }, (_, i) => ({
      session_id: crew,
      t_ms: i * 100,
      lat: 51.5 + i * 1e-5,
      lon: -0.1,
      speed_mps: 4,
      heading_deg: 0,
    }));
    const { error } = await user.db.from("gps_points").insert(fixes);
    expect(error).toBeNull();
    for (const path of [`/app/cox/${crew}`, `/app/cox/compare?a=${crew}`]) {
      const res = await page.request.get(path);
      expect(res.status(), path).toBe(200);
      const html = await res.text();
      const sent = html.match(/tMs\\?":/g)?.length ?? 0;
      expect(sent, path).toBeGreaterThan(1000);
      expect(sent, path).toBeLessThanOrEqual(2000);
      expect(html, path).toMatch(/tMs\\?":299900\b/);
    }
  });

  test("the history chart keeps the newest sessions, and the lists say when they stop short", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const { data: team } = await user.db.rpc("ensure_own_team", { p_name: "test crew" });
    const at = (hours: number) => new Date(Date.UTC(2026, 0, 1) + hours * 3_600_000).toISOString();
    // 101 crew outings, then 501 seat sessions after them, one stroke each.
    const crews = Array.from({ length: 101 }, (_, i) => ({ id: randomUUID(), team_id: team, kind: "crew", recorded_at: at(i), created_by: user.id }));
    const seats = Array.from({ length: 501 }, (_, i) => ({
      id: randomUUID(), team_id: team, kind: "node", seat_number: 1, recorded_at: at(200 + i), stroke_count: 1,
      device_id: "node-1", session_uuid: randomUUID(), units: "kg", created_by: user.id,
    }));
    expect((await user.db.from("sessions").insert(crews)).error).toBeNull();
    expect((await user.db.from("sessions").insert(seats)).error).toBeNull();
    const strokes = seats.map((s) => ({
      session_id: s.id, rec: 0, seq: 1, catch_ms: 1000, drive_ms: 700, recovery_ms: 1300, peak: 50, peak_pos_pct: 40,
      impulse: 25, rise_rate: 200, third1: 8, third2: 12, third3: 5, curve_valid: true,
    }));
    expect((await user.db.from("strokes").insert(strokes)).error).toBeNull();

    await page.goto("/app/force");
    await expect(page.getByText("Only the most recent sessions are listed; older ones aren’t shown here.")).toBeVisible();
    await expect(page.getByText(/The most recent sessions, by seat; older ones aren’t in the chart/)).toBeVisible();
    await expect(page.getByRole("img", { name: /across 500 sessions/ })).toBeVisible();
    // The oldest seat session is past the list and, now, past the chart too.
    const html = await (await page.request.get("/app/force")).text();
    expect(html).toContain(seats[500].id);
    expect(html).not.toContain(seats[0].id);

    await page.goto("/app/cox");
    await expect(page.getByText("Only the 100 most recent outings are listed; older ones aren’t shown here.")).toBeVisible();
    await page.goto("/app/cox/compare");
    await expect(page.getByText("The lists hold the 100 most recent outings; older ones aren’t in them.")).toBeVisible();
  });

  test("the history chart's cap counts only the seat sessions it draws", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const { data: team } = await user.db.rpc("ensure_own_team", { p_name: "test crew" });
    const at = (hours: number) => new Date(Date.UTC(2026, 0, 1) + hours * 3_600_000).toISOString();
    // 500 seat sessions with a stroke each, crew rows in among them, and
    // only a crew row and an empty seat older than all of them.
    const seats = Array.from({ length: 500 }, (_, i) => ({
      id: randomUUID(), team_id: team, kind: "node", seat_number: 1, recorded_at: at(10 + i), stroke_count: 1,
      device_id: "node-1", session_uuid: randomUUID(), units: "kg", created_by: user.id,
    }));
    const crews = Array.from({ length: 60 }, (_, i) => ({ id: randomUUID(), team_id: team, kind: "crew", recorded_at: at(10 + i * 8), created_by: user.id }));
    crews.push({ id: randomUUID(), team_id: team, kind: "crew", recorded_at: at(0), created_by: user.id });
    const empty = {
      id: randomUUID(), team_id: team, kind: "node", seat_number: 2, recorded_at: at(1), stroke_count: 0,
      device_id: "node-2", session_uuid: randomUUID(), units: "kg", created_by: user.id,
    };
    expect((await user.db.from("sessions").insert([...seats, empty])).error).toBeNull();
    expect((await user.db.from("sessions").insert(crews)).error).toBeNull();
    const strokes = seats.map((s) => ({
      session_id: s.id, rec: 0, seq: 1, catch_ms: 1000, drive_ms: 700, recovery_ms: 1300, peak: 50, peak_pos_pct: 40,
      impulse: 25, rise_rate: 200, third1: 8, third2: 12, third3: 5, curve_valid: true,
    }));
    expect((await user.db.from("strokes").insert(strokes)).error).toBeNull();

    await page.goto("/app/force");
    await expect(page.getByRole("img", { name: /across 500 sessions/ })).toBeVisible();
    await expect(page.getByText(/Every session so far, by seat\./)).toBeVisible();
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

  // The typed time is the coach's wall clock; the server runs in UTC (Vercel
  // does, and so does this test's server, see playwright.config.ts). 21:30 on
  // 15 January in New York is 02:30 the next day in UTC, in winter time, while
  // today New York is on summer time.
  test.describe("in a browser in New York, in English (UK)", () => {
    test.use({ timezoneId: "America/New_York", locale: "en-GB" });

    test("a typed time is stored as that time in the coach's zone, and shown in it", async ({ page, context, baseURL }) => {
      const user = await makeUser();
      await signInBrowser(context, user, baseURL!);
      const hydration: string[] = [];
      const check = (text: string) => {
        if (/hydrat|Minified React error #4(18|19|20|21|22|23|25)/i.test(text)) hydration.push(text);
      };
      page.on("console", (m) => m.type() === "error" && check(m.text()));
      page.on("pageerror", (e) => check(e.message));

      await page.goto("/app/force");
      await page.getByLabel("Files").setInputFiles(await crewZip(2, 6));
      await page.getByLabel("When was it rowed?").fill("2026-01-15T21:30");
      await page.getByRole("button", { name: "Upload" }).click();
      await expect(page).toHaveURL(/\/app\/force\/[0-9a-f-]{36}$/, { timeout: 30_000 });
      const crew = page.url().split("/").pop()!;

      const { data: rows } = await user.db.from("sessions").select("recorded_at");
      expect(rows).toHaveLength(3);
      for (const r of rows ?? []) expect(new Date(r.recorded_at).toISOString()).toBe("2026-01-16T02:30:00.000Z");

      const shown = "15/01/2026, 21:30:00";
      // Arrived at by client-side navigation, then loaded afresh.
      await expect(page.locator("time").first()).toHaveText(shown);
      await page.reload();
      await expect(page.locator("time").first()).toHaveText(shown);
      for (const path of ["/app/force", "/app/cox", `/app/cox/${crew}`]) {
        await page.goto(path);
        await expect(page.locator("time").first()).toHaveText(shown);
      }
      await page.goto("/app/cox/compare");
      await expect(page.locator("option", { hasText: "· 15/01/2026" })).toHaveCount(2);
      await expect(page.locator("option", { hasText: "16/01/2026" })).toHaveCount(0);
      expect(hydration).toEqual([]);
    });
  });

  // The form posts to the server action itself, so it works before any script
  // has run. With no script the time isn't sent, and the server takes now.
  test.describe("with JavaScript off", () => {
    test.use({ javaScriptEnabled: false });

    test("an upload still goes through, dated now", async ({ page, context, baseURL }) => {
      const user = await makeUser();
      await signInBrowser(context, user, baseURL!);
      await page.goto("/app/force");
      const form = page.locator("form").filter({ has: page.getByLabel("Files") });
      await expect(form).not.toHaveAttribute("action", /^javascript:/);
      await page.getByLabel("Files").setInputFiles(seatFiles(1));
      const before = Date.now();
      await page.getByRole("button", { name: "Upload" }).click();

      await expect.poll(async () => (await user.db.from("sessions").select("id")).data?.length, { timeout: 30_000 }).toBe(1);
      const { data: rows } = await user.db.from("sessions").select("recorded_at");
      const at = new Date(rows![0].recorded_at).getTime();
      expect(at).toBeGreaterThanOrEqual(before - 1000);
      expect(at).toBeLessThanOrEqual(Date.now() + 1000);
    });
  });

  test("a session that isn't there is a 404 inside the dashboard", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    for (const path of [`/app/force/${randomUUID()}`, "/app/force/not-an-id", `/app/cox/${randomUUID()}`]) {
      const res = await page.goto(path);
      expect(res?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nothing here.");
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    }
  });

  test("a seat whose curves file Storage doesn't have still shows, without the curve", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const id = await upload(page, seatFiles(1));

    const { data: files } = await user.db.from("session_files").select("path").eq("session_id", id).eq("kind", "curves");
    expect(files).toHaveLength(1);
    const { data: removed, error } = await user.db.storage.from("sessions").remove(files!.map((f) => f.path));
    expect(error).toBeNull();
    expect(removed).toHaveLength(1);

    await page.reload();
    await expect(page.getByRole("slider", { name: "Stroke" })).toBeVisible();
    await expect(page.getByText("This page didn’t load.")).toHaveCount(0);
  });

  // The layout checks who is signed in, but a click inside the dashboard
  // renders only the page, so a page read is the first to find out.
  test("signed out in another tab, the next click in the dashboard goes to sign in", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    await page.goto("/app/force");

    const other = await context.newPage();
    await other.goto("/app/force");
    await other.getByRole("button", { name: "Sign out" }).click();
    await expect(other).toHaveURL(/\/app\/login$/);

    await page.getByRole("link", { name: "Cox" }).click();
    await expect(page).toHaveURL(/\/app\/login$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
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
