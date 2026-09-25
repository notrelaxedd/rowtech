import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { addToTeam, allow, emailedLink, hasAccount, localSupabaseMissing, mailpitMissing, makeUser, revoke, signInBrowser } from "./support/local-supabase";
import { parseStrokes } from "../lib/session/parse";
import { duration, fmt, summarise, type SessionSummary } from "../lib/session/analyse";
import { expectSkipLink } from "./support/skip-link";
import { sendWhileHeld } from "./support/pending";

test("the dashboard is closed to people who aren't signed in", async ({ page }) => {
  await page.goto("/app/force");
  await expect(page).toHaveURL(/\/app\/login/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sign in");
  await expect(page.getByRole("link", { name: /apply for the beta/i })).toBeVisible();
});

// A link inside a sentence can't rely on its colour alone (A11Y-002).
test("the sign-in page's beta link is underlined, not just coloured", async ({ page }) => {
  await page.goto("/app/login");
  const link = page.getByRole("main").getByRole("link", { name: /apply for the beta/i });
  await expect(link).toHaveCSS("text-decoration-line", "underline");
});

test("a stale magic link says so instead of failing quietly", async ({ page }) => {
  await page.goto("/auth/callback");
  await expect(page).toHaveURL(/\/app\/login\?error=link/);
  await expect(page.getByRole("alert").first()).toContainText(/expired|already used/i);
  // No new link is sent by itself: the page says how to get one (CNT-003).
  await expect(page.getByRole("alert").first()).toContainText("Enter your email for a new one.");
});

// Google's own button, built to its guidelines (LEG-003), still starts the same
// sign-in: the server action sends the browser to Supabase's Google authorize
// URL, which comes back to /auth/callback. The request is stopped there: the
// local stack has no Google provider.
test("Continue with Google still sends the browser to Google sign-in", async ({ page, baseURL }) => {
  test.skip(!!localSupabaseMissing, localSupabaseMissing ?? "");
  await page.route("**/auth/v1/authorize?**", (route) => route.fulfill({ status: 200, contentType: "text/plain", body: "stopped" }));
  await page.goto("/app/login");
  const button = page.getByRole("button", { name: "Continue with Google" });
  await expect(button).toHaveCSS("height", "40px");
  const authorize = page.waitForRequest((r) => new URL(r.url()).pathname === "/auth/v1/authorize");
  await button.click();
  const url = new URL((await authorize).url());
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("redirect_to")).toBe(`${baseURL}/auth/callback?next=%2Fapp`);
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
    // While it sends, a screen reader hears so, and focus stays on the button.
    const form = page.locator("form").filter({ has: page.getByLabel("Email") });
    const sent = await sendWhileHeld(page, form, page.getByRole("button", { name: /email me a link/i }), "Sending your sign-in link…");
    // The result replaces the form, and focus moves to it rather than to the page.
    await expect(page.getByRole("heading", { name: "Check your email." })).toBeFocused();
    expect(sent.posts()).toBe(1);
    expect(await hasAccount(email)).toBe(false);
  });

  // Sign-ups are off (supabase/config.toml, as they should be on the rowtech
  // project); a magic link still works for an account that was made by hand.
  test("an account on the beta list signs in with the emailed link", async ({ page }) => {
    test.skip(!!mailpitMissing, mailpitMissing ?? "");
    const user = await makeUser();
    await page.goto("/app/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("button", { name: /email me a link/i }).click();
    await expect(page.getByRole("heading", { name: "Check your email." })).toBeVisible();

    // The link goes to Auth, which sends the browser to /auth/callback with a
    // code; the callback swaps it for a session.
    const callback = page.waitForResponse((r) => new URL(r.url()).pathname === "/auth/callback");
    await page.goto(await emailedLink(user.email));
    const swapped = await callback;
    expect(new URL(swapped.url()).searchParams.get("code")).toBeTruthy();
    expect(swapped.status()).toBe(307);
    await expect(page).toHaveURL(/\/app\/force$/);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

    // The session cookies are the server's alone: no script on the page reads them.
    const session = (await page.context().cookies()).filter((c) => c.name.startsWith("sb-"));
    expect(session.some((c) => c.name.includes("-auth-token"))).toBe(true);
    for (const c of session) {
      expect(c.httpOnly, c.name).toBe(true);
      expect(c.sameSite, c.name).toBe("Lax");
    }
    expect(await page.evaluate(() => document.cookie)).not.toContain("sb-");
  });
});

// Uploading needs a signed-in beta account, so these run against a local
// Supabase (see README, "Tests"). Each test makes its own user; nothing here
// can reach the production project (tests/support/local-supabase.ts).
test.describe("signed in", () => {
  test.skip(!!localSupabaseMissing, localSupabaseMissing ?? "");

  const seatFiles = (n: number) =>
    ["meta.json", "strokes.csv", "curves.bin", "events.csv"].map((f) => `tests/fixtures/demo/seat-${n}/${f}`);

  /** Files of the given names and sizes, for the picker. */
  const sized = (files: Array<[name: string, bytes: number]>) =>
    files.map(([name, bytes]) => ({ name, mimeType: "application/octet-stream", buffer: Buffer.alloc(bytes, 1) }));

  async function crewZip(...seats: number[]) {
    const entries: Record<string, Uint8Array> = {};
    for (const n of seats) {
      for (const f of ["meta.json", "strokes.csv", "curves.bin", "events.csv"]) {
        entries[`outing/seat-${n}/${f}`] = new Uint8Array(await readFile(`tests/fixtures/demo/seat-${n}/${f}`));
      }
    }
    return { name: "outing.zip", mimeType: "application/zip", buffer: Buffer.from(zipSync(entries)) };
  }

  async function upload(page: Page, files: Parameters<Page["setInputFiles"]>[1], rowedAt?: string, boat?: string) {
    await page.goto("/app/force");
    await page.getByLabel("Files").setInputFiles(files);
    if (rowedAt) await page.getByLabel("When was it rowed?").fill(rowedAt);
    if (boat) await page.getByLabel("Boat").fill(boat);
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page).toHaveURL(/\/app\/force\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    return page.url().split("/").pop()!;
  }

  // An empty dashboard says where a session's files come from (BIZ-019).
  test("with no sessions yet, the list says where the files come from", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    await page.goto("/app/force");
    const empty = page.getByRole("heading", { name: "Sessions", level: 1 }).locator("+ div");
    await expect(empty).toContainText("Nothing here yet.");
    await expect(empty).toContainText("microSD card");
    for (const f of ["meta.json", "strokes.csv", "curves.bin", "events.csv"]) await expect(empty).toContainText(f);
    await expect(empty).toContainText("Wi-Fi");
  });

  test("the dashboard's first Tab is a link past its header to the content", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    await page.goto("/app/force");
    await expectSkipLink(page);
  });

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

  test("the team a first upload makes isn't named after the uploader's email", async ({ page, context, baseURL }) => {
    const user = await makeUser({ prefix: "sam" });
    await signInBrowser(context, user, baseURL!);
    await upload(page, seatFiles(1));

    const { data: teams } = await user.db.from("teams").select("name");
    expect(teams).toHaveLength(1);
    const local = user.email.split("@")[0];
    expect(teams![0].name).not.toContain(local);
    expect(teams![0].name.toLowerCase()).not.toContain("sam");
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

  // One word for each thing (CNT-002): an upload is a session, what was rowed
  // is an outing, and a piece (a part of an outing) isn't something the
  // dashboard has, so it never says so.
  test("the dashboard calls an upload a session and a crew's an outing, never a piece", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    await page.goto("/app/force");
    await expect(page.getByLabel("Session name")).toBeVisible();
    await page.getByLabel("Files").setInputFiles(await crewZip(2, 6));
    await page.getByLabel("Session name").fill("4 x 750m, rate 28");
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page).toHaveURL(/\/app\/force\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    const crew = page.url().split("/").pop()!;
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("4 x 750m, rate 28");
    await upload(page, await crewZip(3, 7));

    for (const path of ["/app/force", "/app/cox", "/app/cox/compare", `/app/cox/${crew}`, `/app/force/${crew}`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("body"), path).not.toContainText(/\bpieces?\b/i);
    }
    await page.goto("/app/cox/compare");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Two outings, side by side");
    await expect(page).toHaveTitle("Compare outings · RowTech");
  });

  // Each session's figures are stored when its strokes are written; they are
  // the ones the session page works out from the same rows.
  test("an outing's figures are the ones its files give, and follow its strokes", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const crew = await upload(page, await crewZip(2, 6));

    const { data: rows, error } = await user.db.from("session_stats").select("*").eq("parent_id", crew).order("seat_number");
    expect(error).toBeNull();
    expect(rows?.map((r) => r.seat_number)).toEqual([2, 6]);
    const summaries: SessionSummary[] = [];
    for (const row of rows ?? []) {
      const s = summarise(parseStrokes((await readFile(`tests/fixtures/demo/seat-${row.seat_number}/strokes.csv`)).toString()));
      summaries.push(s);
      expect(row.strokes).toBe(s.strokes);
      // First catch to the last release, not to the longest drive.
      expect(row.span_ms).toBe(s.durationMs);
      expect(row.avg_peak).toBeCloseTo(s.avgPeak, 3);
      expect(row.avg_impulse).toBeCloseTo(s.avgImpulse, 3);
      expect(row.avg_rise_rate).toBeCloseTo(s.avgRiseRate, 3);
      expect(row.avg_peak_pos_pct).toBeCloseTo(s.avgPeakPosPct, 6);
      expect(row.avg_drive_ms).toBeCloseTo(s.avgDriveMs, 6);
      expect(row.avg_recovery_ms).toBeCloseTo(s.avgRecoveryMs, 6);
      expect(row.consistency_pct).toBeCloseTo(s.consistencyPct!, 3);
    }

    // The compare page shows them, over both seats.
    const both = (get: (s: SessionSummary) => number) => (get(summaries[0]) + get(summaries[1])) / 2;
    await page.goto(`/app/cox/compare?a=${crew}`);
    const cell = (measure: string) => page.getByRole("row").filter({ hasText: measure }).getByRole("cell").nth(1);
    await expect(cell("Strokes")).toHaveText(String(Math.max(summaries[0].strokes, summaries[1].strokes)));
    await expect(cell("Time")).toHaveText(duration(Math.max(summaries[0].durationMs, summaries[1].durationMs)));
    await expect(cell("Avg peak")).toHaveText(fmt(both((s) => s.avgPeak)));
    await expect(cell("Avg impulse")).toHaveText(fmt(both((s) => s.avgImpulse)));
    await expect(cell("Consistency")).toHaveText(`CV ${fmt(both((s) => s.consistencyPct!))}%`);

    // Only the strokes set them: written straight to the session, they're refused.
    const seat = rows![0].session_id;
    expect((await user.db.from("sessions").update({ avg_peak: 999 }).eq("id", seat)).error?.code).toBe("42501");
    expect((await user.db.from("sessions").update({ consistency_pct: 0, span_ms: 0 }).eq("id", seat)).error?.code).toBe("42501");

    // Strokes written or removed some other way move the figures with them.
    expect((await user.db.from("strokes").delete().eq("session_id", seat)).error).toBeNull();
    const { data: emptied } = await user.db.from("session_stats").select("strokes, avg_peak, span_ms").eq("session_id", seat).single();
    expect(emptied).toEqual({ strokes: 0, avg_peak: null, span_ms: null });
    // A seat with no figures is left out of the outing's, not counted as 0.
    await page.reload();
    await expect(cell("Avg peak")).toHaveText(fmt(summaries[1].avgPeak));
    await expect(cell("Drive : recovery")).toHaveText(`1 : ${fmt(summaries[1].avgRecoveryMs / summaries[1].avgDriveMs, 2)}`);
    await expect(cell("Consistency")).toHaveText(`CV ${fmt(summaries[1].consistencyPct!)}%`);
    // Two strokes have no CV; with no seat left that has one, it's a dash.
    const other = rows![1].session_id;
    expect((await user.db.from("strokes").delete().eq("session_id", other).gt("rec", 1)).error).toBeNull();
    await page.reload();
    await expect(cell("Consistency")).toHaveText("—");

    // Writes to one session at the same time each wait for the one before, so
    // none of them leaves the others' strokes out of the figures.
    const stroke = (rec: number) => ({
      session_id: seat, rec, seq: rec + 1, catch_ms: rec * 2_000, drive_ms: 800, recovery_ms: 1_200,
      peak: 1, peak_pos_pct: 30, impulse: 1, rise_rate: 1, third1: 1, third2: 1, third3: 1,
    });
    const writes = await Promise.all([
      ...Array.from({ length: 30 }, (_, rec) => user.db.from("strokes").insert(stroke(rec))),
      ...Array.from({ length: 10 }, (_, i) => user.db.from("strokes").delete().eq("session_id", seat).eq("rec", i * 3)),
    ]);
    expect(writes.map((w) => w.error)).toEqual(writes.map(() => null));
    const { count: kept } = await user.db.from("strokes").select("*", { count: "exact", head: true }).eq("session_id", seat);
    const { data: after } = await user.db.from("session_stats").select("strokes").eq("session_id", seat).single();
    expect(after?.strokes).toBe(kept);
  });

  // The parser takes any catch_ms, so a clock that jumps mid-outing still
  // uploads; its time runs to the last release, past what an int holds.
  test("an outing whose strokes span more than 24.8 days still uploads", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const [meta, csv] = await Promise.all(["meta.json", "strokes.csv"].map((f) => readFile(`tests/fixtures/demo/seat-1/${f}`)));
    const rows = csv.toString().trim().split("\n");
    const last = rows[rows.length - 1].split(",");
    last[2] = String(2_200_000_000); // catch_ms
    rows[rows.length - 1] = last.join(",");
    const strokes = rows.join("\n") + "\n";
    const id = await upload(page, [
      { name: "meta.json", mimeType: "application/json", buffer: meta },
      { name: "strokes.csv", mimeType: "text/csv", buffer: Buffer.from(strokes) },
    ]);

    const { data: row } = await user.db.from("session_stats").select("strokes, span_ms").eq("session_id", id).single();
    const s = summarise(parseStrokes(strokes));
    expect(s.durationMs).toBeGreaterThan(2 ** 31 - 1);
    expect(row).toEqual({ strokes: s.strokes, span_ms: s.durationMs });
  });

  // An uncalibrated node writes raw counts, five or six digits before the
  // point; the database keeps every digit the file has.
  test("Export CSV gives back the node's strokes.csv, raw counts and all", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const [meta, csv] = await Promise.all(["meta.json", "strokes.csv"].map((f) => readFile(`tests/fixtures/demo/seat-1/${f}`)));
    const [header, ...rows] = csv.toString().trim().split("\n");
    const counts = rows.map((row) => {
      const p = row.split(",");
      const scale = (i: number, digits: number) => (p[i] = (Number(p[i]) * 2381.7 + 0.1234).toFixed(digits));
      scale(5, 4); // peak
      scale(7, 5); // impulse
      scale(8, 4); // rise_rate
      scale(9, 5); // third1..3
      scale(10, 5);
      scale(11, 5);
      return p.join(",");
    });
    const strokes = [header, ...counts].join("\n") + "\n";
    await upload(page, [
      { name: "meta.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...JSON.parse(meta.toString()), units: "counts" })) },
      { name: "strokes.csv", mimeType: "text/csv", buffer: Buffer.from(strokes) },
    ]);

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
    expect((await readFile(await download.path())).toString()).toBe(strokes);
  });

  /** Seat n's demo session, stretched to `strokes` strokes (with curves), as a new session. */
  async function longSeat(n: number, strokes: number) {
    const [meta, csv, curves] = await Promise.all(
      ["meta.json", "strokes.csv", "curves.bin"].map((f) => readFile(`tests/fixtures/demo/seat-${n}/${f}`))
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

  test("the history chart keeps the newest sessions, and the lists page back to the oldest", async ({ page, context, baseURL }) => {
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
    await expect(page.getByText(/The most recent sessions with a seat set, by seat; older ones aren’t in the chart/)).toBeVisible();
    await expect(page.getByRole("img", { name: /across 500 sessions/ })).toBeVisible();
    // The oldest seat session is past the first page of the list and, now, past the chart too.
    const html = await (await page.request.get("/app/force")).text();
    expect(html).toContain(seats[500].id);
    expect(html).not.toContain(seats[0].id);
    await expect(page.getByRole("link", { name: "← Newest sessions" })).toHaveCount(0);
    // Older pages reach it, and the oldest crew outing past it.
    await page.getByRole("link", { name: "Older sessions →" }).click();
    await expect(page.locator(`a[href="/app/force/${seats[300].id}"]`)).toBeVisible();
    await page.getByRole("link", { name: "Older sessions →" }).click();
    await expect(page.locator(`a[href="/app/force/${seats[0].id}"]`)).toBeVisible();
    await page.getByRole("link", { name: "Older sessions →" }).click();
    await expect(page.locator(`a[href="/app/force/${crews[0].id}"]`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Older sessions →" })).toHaveCount(0);
    await page.getByRole("link", { name: "← Newest sessions" }).click();
    await expect(page.locator(`a[href="/app/force/${seats[500].id}"]`)).toBeVisible();

    await page.goto("/app/cox");
    await expect(page.locator(`a[href="/app/cox/${crews[0].id}"]`)).toHaveCount(0);
    await page.getByRole("link", { name: "Older outings →" }).click();
    await expect(page.locator(`a[href="/app/cox/${crews[0].id}"]`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Older outings →" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "← Newest outings" })).toBeVisible();
    await page.goto("/app/cox/compare");
    await expect(page.getByText("The lists hold the 100 most recent outings; older ones aren’t in them.")).toBeVisible();
  });

  test("the history chart's cap counts only the seat sessions it draws", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const { data: team } = await user.db.rpc("ensure_own_team", { p_name: "test crew" });
    const at = (hours: number) => new Date(Date.UTC(2026, 0, 1) + hours * 3_600_000).toISOString();
    // 500 seat sessions with a stroke each, crew rows in among them, and
    // only a crew row, an empty seat and a node with no seat set older than
    // all of them.
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
    const unset = {
      id: randomUUID(), team_id: team, kind: "node", seat_number: null, recorded_at: at(2), stroke_count: 1,
      device_id: "node-3", session_uuid: randomUUID(), units: "kg", created_by: user.id,
    };
    expect((await user.db.from("sessions").insert([...seats, empty, unset])).error).toBeNull();
    expect((await user.db.from("sessions").insert(crews)).error).toBeNull();
    const strokes = [...seats, unset].map((s) => ({
      session_id: s.id, rec: 0, seq: 1, catch_ms: 1000, drive_ms: 700, recovery_ms: 1300, peak: 50, peak_pos_pct: 40,
      impulse: 25, rise_rate: 200, third1: 8, third2: 12, third3: 5, curve_valid: true,
    }));
    expect((await user.db.from("strokes").insert(strokes)).error).toBeNull();

    await page.goto("/app/force");
    await expect(page.getByRole("img", { name: /across 500 sessions/ })).toBeVisible();
    await expect(page.getByText(/Every session with a seat set, by seat\./)).toBeVisible();
  });

  test("an outing and its seats stay on one page of the list", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const { data: team } = await user.db.rpc("ensure_own_team", { p_name: "test crew" });
    const at = (hours: number) => new Date(Date.UTC(2026, 0, 1) + hours * 3_600_000).toISOString();
    const seat = (n: number, recorded_at: string, parent_id?: string) => ({
      id: randomUUID(), team_id: team, kind: "node", parent_id: parent_id ?? null, seat_number: n, recorded_at, stroke_count: 0,
      device_id: `node-${n}`, session_uuid: randomUUID(), units: "kg", created_by: user.id,
    });
    // 199 newer seat sessions, so the page's 200-row cut falls inside the crew.
    const crew = { id: randomUUID(), team_id: team, kind: "crew", recorded_at: at(0), created_by: user.id };
    expect((await user.db.from("sessions").insert(crew)).error).toBeNull();
    const rows = [seat(1, at(0), crew.id), seat(2, at(0), crew.id), ...Array.from({ length: 199 }, (_, i) => seat(1, at(1 + i)))];
    expect((await user.db.from("sessions").insert(rows)).error).toBeNull();

    await page.goto("/app/force");
    await expect(page.locator(`a[href="/app/force/${rows[2].id}"]`)).toBeVisible();
    await expect(page.locator(`a[href="/app/force/${crew.id}"]`)).toHaveCount(0);
    await page.getByRole("link", { name: "Older sessions →" }).click();
    await expect(page.locator(`a[href="/app/force/${crew.id}"]`)).toContainText("2 seats");
    await expect(page.getByRole("link", { name: "Older sessions →" })).toHaveCount(0);
  });

  // A seat uploaded again on its own stays in its crew but takes the new time,
  // so it can land on another page from the crew.
  test("a crew counts a seat uploaded again later, on whatever page the seat is", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const crew = await upload(page, await crewZip(2, 6), "2026-01-01T08:00");
    await upload(page, seatFiles(2));
    const { data: seats } = await user.db.from("sessions").select("stroke_count, recorded_at").eq("parent_id", crew);
    expect(seats).toHaveLength(2);
    expect(new Set(seats?.map((s) => s.recorded_at)).size).toBe(2);
    const strokes = (seats ?? []).reduce((a, s) => a + s.stroke_count, 0);

    // 200 sessions between the crew and the seat's new time push the crew to the second page.
    const { data: team } = await user.db.rpc("ensure_own_team", { p_name: "test crew" });
    const at = (hours: number) => new Date(Date.UTC(2026, 1, 1) + hours * 3_600_000).toISOString();
    const rows = Array.from({ length: 200 }, (_, i) => ({
      id: randomUUID(), team_id: team, kind: "node", seat_number: 1, recorded_at: at(i), stroke_count: 0,
      device_id: "node-1", session_uuid: randomUUID(), units: "kg", created_by: user.id,
    }));
    expect((await user.db.from("sessions").insert(rows)).error).toBeNull();

    await page.goto("/app/force");
    await expect(page.locator(`a[href="/app/force/${crew}"]`)).toHaveCount(0);
    await page.getByRole("link", { name: "Older sessions →" }).click();
    const row = page.locator(`a[href="/app/force/${crew}"]`);
    await expect(row).toContainText("· 2 seats");
    await expect(row).toContainText(`${strokes} strokes`);
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

  test("while an upload is read, a screen reader hears so and focus stays put", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    await page.goto("/app/force");
    await page.getByLabel("Files").setInputFiles(seatFiles(1));
    const form = page.locator("form").filter({ has: page.getByLabel("Files") });
    const sent = await sendWhileHeld(page, form, page.getByRole("button", { name: "Upload" }), "Reading the session…");
    await expect(page).toHaveURL(/\/app\/force\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    expect(sent.posts()).toBe(1);
  });

  test("the picked files are listed with their sizes, and the time says it defaults to now", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    await page.goto("/app/force");
    await expect(page.getByLabel("When was it rowed?")).toHaveAccessibleDescription("Defaults to now; change it if the outing was earlier.");

    const files = sized([["meta.json", 900], ["strokes.csv", 30 * 1024], ["curves.bin", 3 * 1024 * 1024 / 2]]);
    await page.getByLabel("Files").setInputFiles(files);
    const picked = page.getByLabel("Files");
    await expect(picked).toHaveAccessibleDescription(/^3 files, 1\.5 MB/);
    const listed = page.locator("form li").filter({ has: page.locator(".readout") });
    await expect(listed).toHaveText(["meta.json, 900 B", "strokes.csv, 30 KB", "curves.bin, 1.5 MB"]);

    // Past six, the rest are counted.
    await page.getByLabel("Files").setInputFiles(sized(Array.from({ length: 8 }, (_, i) => [`f${i}.csv`, 2048] as [string, number])));
    await expect(picked).toHaveAccessibleDescription(/^8 files, 16 KB/);
    await expect(listed).toHaveCount(6);
    await expect(page.getByText("and 2 more")).toBeVisible();

    // A long name with no spaces or hyphens wraps instead of pushing the page sideways on a phone.
    await page.setViewportSize({ width: 375, height: 900 });
    await page.getByLabel("Files").setInputFiles(sized([["rowtech_session_export_20260924_bow_seat_three_final.zip", 5000]]));
    await expect(listed).toHaveText(["rowtech_session_export_20260924_bow_seat_three_final.zip, 4.9 KB"]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test("while an upload is sent, a bar and a line say it's under way", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    await page.goto("/app/force");
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route(
      (url) => url.pathname === "/app/force",
      async (route) => {
        if (route.request().method() === "POST") await held;
        await route.fallback();
      }
    );
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await page.getByLabel("Files").setInputFiles(seatFiles(1));
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByRole("progressbar", { name: "Upload" })).toBeVisible();
    // No value: how far along it is isn't known.
    await expect(page.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
    await expect(page.getByText("This can take a minute for large sessions.")).toBeVisible();
    release();
    await expect(page).toHaveURL(/\/app\/force\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  });

  test("when several seats can't be read, each one's reason is listed", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    await page.goto("/app/force");
    const entries: Record<string, Uint8Array> = {};
    for (const n of [1, 2]) {
      entries[`outing/seat-${n}/meta.json`] = new Uint8Array(await readFile(`tests/fixtures/demo/seat-${n}/meta.json`));
      entries[`outing/seat-${n}/strokes.csv`] = strToU8(`not,the,header\n1,2,3\n`);
    }
    await page.getByLabel("Files").setInputFiles({ name: "outing.zip", mimeType: "application/zip", buffer: Buffer.from(zipSync(entries)) });
    await page.getByRole("button", { name: "Upload" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "2 seats couldn't be read." });
    await expect(alert).toBeVisible({ timeout: 30_000 });
    const reasons = alert.getByRole("listitem");
    await expect(reasons).toHaveCount(2);
    await expect(reasons.nth(0)).toContainText("outing/seat-1: strokes.csv doesn't have the header this firmware writes.");
    await expect(reasons.nth(1)).toContainText("outing/seat-2: strokes.csv doesn't have the header this firmware writes.");
    // The header lines have no spaces, and still don't push the page sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await user.db.from("sessions").select("id")).data).toEqual([]);
    // The form is emptied after the attempt, and so is the list of what was picked.
    await expect(page.getByLabel("Files")).not.toHaveAccessibleDescription(/file/);
  });

  // React resets the form after every submit, error or not, which blanks the
  // time; what's stored is what the field shows when the form is sent.
  test("after a refused upload, a blank time is now, not the time typed before", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    await page.goto("/app/force");
    await page.getByLabel("When was it rowed?").fill("2026-01-15T21:30");
    await page.getByLabel("Files").setInputFiles({ name: "meta.json", mimeType: "application/json", buffer: Buffer.from("{") });
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByText(/Pick a session folder with meta\.json/)).toBeVisible();
    await expect(page.getByLabel("When was it rowed?")).toHaveValue("");

    await page.getByLabel("Files").setInputFiles(seatFiles(1));
    const before = Date.now();
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page).toHaveURL(/\/app\/force\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    const { data: rows } = await user.db.from("sessions").select("recorded_at");
    const at = new Date(rows![0].recorded_at).getTime();
    expect(at).toBeGreaterThanOrEqual(before - 1000);
    expect(at).toBeLessThanOrEqual(Date.now() + 1000);
  });

  // The form posts to the server action itself, so it works before any script
  // has run. With no script the time can't be read in the coach's zone: left
  // blank the server takes now, and a typed time is refused, not misread.
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

    test("a typed time is refused rather than stored as some other time", async ({ page, context, baseURL }) => {
      const user = await makeUser();
      await signInBrowser(context, user, baseURL!);
      await page.goto("/app/force");
      await page.getByLabel("Files").setInputFiles(seatFiles(1));
      await page.getByLabel("When was it rowed?").fill("2026-01-15T21:30");
      await page.getByRole("button", { name: "Upload" }).click();
      await expect(page.getByText("That date and time couldn't be read. Pick it again.")).toBeVisible();
      expect((await user.db.from("sessions").select("id")).data).toEqual([]);
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
    await expect(page.getByText("The node didn’t keep a curve for this stroke.")).toBeVisible();
  });

  test("the stroke list is a list of rows, each with a button to show it and one to compare it", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    await upload(page, seatFiles(1));

    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(page.getByRole("option")).toHaveCount(0);
    const list = page.getByRole("list", { name: "Strokes" });
    const slider = page.getByRole("slider", { name: "Stroke" });
    await expect(list.getByRole("listitem").first()).toHaveAttribute("aria-posinset", "1");
    const total = await slider.getAttribute("aria-valuemax");
    await expect(list.getByRole("listitem").first()).toHaveAttribute("aria-setsize", total!);

    await list.getByRole("button", { name: "Stroke 3", exact: true }).click();
    await expect(slider).toHaveAttribute("aria-valuenow", "3");
    await expect(list.getByRole("button", { name: "Stroke 3", exact: true })).toHaveAttribute("aria-current", "true");
    await expect(list.getByRole("button", { name: "Stroke 1", exact: true })).not.toHaveAttribute("aria-current");

    // The buttons are reached with Tab, as any others are.
    await list.getByRole("button", { name: "Stroke 3", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(list.getByRole("listitem").nth(2).getByRole("button", { name: "compare" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(list.getByRole("listitem").nth(2).getByRole("button", { name: "comparing" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear comparison" })).toBeVisible();
  });

  // The page signs each curves link for an hour; a tab left open longer gets
  // Storage's refusal, which is not the node having kept no curve.
  test("a curves file that doesn't load says so, and is tried again when its seat is picked", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const expired = /\/storage\/v1\/object\/sign\//;
    await page.route(expired, (route) =>
      route.fulfill({ status: 400, contentType: "application/json", body: '{"statusCode":"400","error":"InvalidJWT","message":"\\"exp\\" claim timestamp check failed"}' })
    );
    await upload(page, await crewZip(2, 6));

    const failed = page.getByText("Couldn’t load the curve. Reload the page to try again.");
    const noCurve = page.getByText("The node didn’t keep a curve for this stroke.");
    await expect(failed).toBeVisible();
    await expect(noCurve).toHaveCount(0);

    await page.unroute(expired);
    const loading = page.getByText("Loading the curve…");
    for (const seat of ["seat 6", "seat 2"]) {
      // Hold the fetch, so the page can be seen while it waits: it says the
      // curve is loading, not that the node kept none.
      let release!: () => void;
      const held = new Promise<void>((r) => (release = r));
      await page.route(expired, async (route) => {
        await held;
        await route.continue();
      });
      const fetched = page.waitForResponse(expired);
      await page.getByRole("button", { name: seat }).click();
      await expect(loading).toBeVisible();
      await expect(failed).toHaveCount(0);
      await expect(noCurve).toHaveCount(0);
      release();
      expect((await fetched).ok(), seat).toBe(true);
      await page.unroute(expired);
      await expect(loading).toHaveCount(0);
      await expect(page.getByRole("button", { name: seat })).toHaveAttribute("aria-pressed", "true");
      await expect(failed).toHaveCount(0);
      await expect(noCurve).toHaveCount(0);
    }
  });

  test("a node whose seat was never set is stored with no seat, and shows as seat ?", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const files = await Promise.all(seatFiles(1).map(async (f) => ({ name: f.split("/").pop()!, buffer: await readFile(f) })));
    const meta = files.find((f) => f.name === "meta.json")!;
    meta.buffer = Buffer.from(JSON.stringify({ ...JSON.parse(meta.buffer.toString()), seat: 0 }));
    const id = await upload(page, files.map((f) => ({ ...f, mimeType: "application/octet-stream" })));

    expect((await user.db.from("sessions").select("seat_number").eq("id", id).single()).data).toEqual({ seat_number: null });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Seat ?");
    await page.goto("/app/force");
    await expect(page.getByRole("link", { name: /^Seat \?/ })).toBeVisible();
  });

  test("the team's owner can delete an outing, its seats and their files", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    await upload(page, await crewZip(2, 6));
    const { data: files } = await user.db.from("session_files").select("path");
    expect(files).toHaveLength(8);

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete session" }).click();
    await expect(page).toHaveURL(/\/app\/force$/, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: /2 seats/ })).toHaveCount(0);

    expect((await user.db.from("sessions").select("id")).data).toEqual([]);
    for (const f of files!) {
      const { error } = await user.db.storage.from("sessions").download(f.path);
      expect(error, f.path).toBeTruthy();
    }
  });

  test("deleting a crew's last seat takes the crew with it", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const crew = await upload(page, await crewZip(2, 6));
    const { data: seats } = await user.db.from("sessions").select("id").eq("parent_id", crew).order("seat_number");

    page.on("dialog", (d) => d.accept());
    for (const [i, seat] of seats!.entries()) {
      await page.goto(`/app/force/${seat.id}`);
      await page.getByRole("button", { name: "Delete session" }).click();
      await expect(page).toHaveURL(/\/app\/force$/, { timeout: 30_000 });
      const { data: left } = await user.db.from("sessions").select("id");
      const expected = i === 0 ? [crew, seats![1].id] : [];
      expect(left?.map((r) => r.id).sort(), `after seat ${i + 1}`).toEqual(expected.sort());
    }
  });

  test("a team member who isn't a coach can't delete a session, and is told why", async ({ page, context, baseURL }) => {
    const owner = await makeUser();
    await signInBrowser(context, owner, baseURL!);
    const id = await upload(page, seatFiles(1));
    const { data: row } = await owner.db.from("sessions").select("team_id").eq("id", id).single();

    const member = await makeUser();
    await addToTeam(row!.team_id, member, "member");
    await context.clearCookies();
    await signInBrowser(context, member, baseURL!);
    await page.goto(`/app/force/${id}`);

    let asked = false;
    page.once("dialog", (d) => {
      asked = true;
      return d.accept();
    });
    await page.getByRole("button", { name: "Delete session" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Only the team's owner or a coach can delete a session." })).toBeVisible({ timeout: 30_000 });
    expect(asked).toBe(true);
    await expect(page).toHaveURL(new RegExp(`/app/force/${id}$`));
    expect((await owner.db.from("sessions").select("id")).data).toEqual([{ id }]);
    const { count } = await owner.db.from("session_files").select("*", { count: "exact", head: true });
    expect(count).toBe(4);
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

  // With a boat, a side belongs to that seat of the boat: set once, it holds
  // for the boat's next outing too.
  test("port and starboard set in a boat carry over to its next outing", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const boat = "Test VIII";
    const first = await upload(page, await crewZip(2, 6), undefined, boat);
    await expect(page.getByText(`· ${boat}`)).toBeVisible();
    for (const path of ["/app/force", "/app/cox"]) {
      await page.goto(path);
      await expect(page.locator(`a[href$="/${first}"]`)).toContainText(`· ${boat}`);
    }

    await page.goto(`/app/cox/${first}`);
    await expect(page.getByText(`· ${boat} · 2 seats`)).toBeVisible();
    const seat = (n: number) => page.getByRole("listitem").filter({ hasText: `seat ${n}` }).filter({ has: page.getByRole("button", { name: "P" }) });
    for (const [n, side] of [[2, "P"], [6, "S"]] as const) {
      const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes(`/app/cox/${first}`));
      await seat(n).getByRole("button", { name: side }).click();
      await saved;
    }
    await page.reload();
    await expect(seat(2).getByRole("button", { name: "P" })).toHaveAttribute("aria-pressed", "true");
    await expect(seat(6).getByRole("button", { name: "S" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/wasn.t saved/)).toHaveCount(0);

    // The same seats on another day: new sessions, so a new outing, in the same boat.
    const again = await crewZip(2, 6);
    const entries = unzipSync(again.buffer);
    for (const n of [2, 6]) {
      const meta = JSON.parse(strFromU8(entries[`outing/seat-${n}/meta.json`]));
      entries[`outing/seat-${n}/meta.json`] = strToU8(JSON.stringify({ ...meta, uuid: randomUUID() }));
    }
    const second = await upload(page, { ...again, buffer: Buffer.from(zipSync(entries)) }, undefined, boat);
    expect(second).not.toBe(first);
    const { data: boats } = await user.db.from("boats").select("id");
    expect(boats).toHaveLength(1);

    await page.goto(`/app/cox/${second}`);
    await expect(seat(2).getByRole("button", { name: "P" })).toHaveAttribute("aria-pressed", "true");
    await expect(seat(6).getByRole("button", { name: "S" })).toHaveAttribute("aria-pressed", "true");
  });

  // Nothing writes a GPS clock yet; this is the day Vieve does, on an outing
  // whose seats have all gone.
  test("an outing on one clock with no seats left still shows", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const crew = await upload(page, await crewZip(2, 6));
    expect((await user.db.from("sessions").delete().eq("parent_id", crew)).error).toBeNull();
    expect((await user.db.from("sessions").update({ clock_source: "gps" }).eq("id", crew)).error).toBeNull();

    const res = await page.goto(`/app/cox/${crew}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Catch spread and sequencing" })).toBeVisible();
    await expect(page.getByText("one clock", { exact: true })).toBeVisible();
    await expect(page.getByText("· 0 seats")).toBeVisible();
  });
  /** Seat n's demo strokes, summed up the way the pages do it. */
  const demoSummary = async (n: number) => summarise(parseStrokes((await readFile(`tests/fixtures/demo/seat-${n}/strokes.csv`)).toString()));
  const demoImpulse = async (n: number) =>
    parseStrokes((await readFile(`tests/fixtures/demo/seat-${n}/strokes.csv`)).toString()).reduce((a, s) => a + s.impulse, 0);

  test("a crew outing is on the Cox tab, and its page shares the work out seat by seat", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const single = await upload(page, seatFiles(1));
    const crew = await upload(page, await crewZip(2, 6));

    await page.goto("/app/cox");
    await expect(page.locator(`a[href="/app/cox/${single}"]`)).toHaveCount(0);
    // One outing: nothing to compare it with yet.
    await expect(page.getByRole("link", { name: "Compare two outings →" })).toHaveCount(0);
    const link = page.locator(`a[href="/app/cox/${crew}"]`);
    await expect(link).toContainText("2 seats");
    await expect(link).toContainText("seat clocks");
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/app/cox/${crew}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("2 seats");
    await expect(page.getByText("· 2 seats")).toBeVisible();
    await expect(page.getByText("No GPS track on this outing.")).toBeVisible();
    // Each node counts from its own boot, so no catch spread until Vieve.
    await expect(page.getByText("needs Vieve")).toBeVisible();

    const [two, six] = await Promise.all([demoImpulse(2), demoImpulse(6)]);
    const even = (two + six) / 2;
    const share = page.locator("section").filter({ has: page.getByRole("heading", { name: "Who’s carrying the boat" }) });
    for (const [seat, total] of [["seat 2", two], ["seat 6", six]] as const) {
      const off = ((total - even) / even) * 100;
      await expect(share.getByRole("listitem").filter({ hasText: seat })).toContainText(
        `${fmt((total / (two + six)) * 100)}% ${off >= 0 ? "+" : "−"}${fmt(Math.abs(off))}`
      );
    }

    // With both sides set, the balance is each side's share of the impulse.
    const sides = page.locator("section").filter({ has: page.getByRole("heading", { name: "Port and starboard" }) });
    for (const [seat, side] of [["seat 2", "P"], ["seat 6", "S"]] as const) {
      const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes(`/app/cox/${crew}`));
      await sides.getByRole("listitem").filter({ hasText: seat }).getByRole("button", { name: side }).click();
      await saved;
    }
    const balance = [`port ${fmt((two / (two + six)) * 100)}%`, `starboard ${fmt((six / (two + six)) * 100)}%`];
    for (const text of balance) await expect(sides.getByText(text)).toBeVisible();
    await page.reload();
    for (const text of balance) await expect(sides.getByText(text)).toBeVisible();
  });

  test("compare lays two outings side by side, and the pickers change which", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const older = await upload(page, await crewZip(2, 6), "2026-03-01T09:00");
    const newer = await upload(page, await crewZip(3, 7), "2026-03-08T09:00");
    // The newer one has a track: 4 m/s is a 2:05 split.
    const fixes = Array.from({ length: 100 }, (_, i) => ({
      session_id: newer, t_ms: i * 100, lat: 51.5 + i * 1e-5, lon: -0.1, speed_mps: 4, heading_deg: 0,
    }));
    expect((await user.db.from("gps_points").insert(fixes)).error).toBeNull();

    await page.goto("/app/cox");
    await page.getByRole("link", { name: "Compare two outings →" }).click();
    await expect(page).toHaveURL(/\/app\/cox\/compare$/);
    // Nothing picked yet: the two newest.
    await expect(page.getByLabel("First")).toHaveValue(newer);
    await expect(page.getByLabel("Second")).toHaveValue(older);

    const [s2, s6, s3, s7] = await Promise.all([2, 6, 3, 7].map(demoSummary));
    const cells = (measure: string) => page.getByRole("row").filter({ hasText: measure }).getByRole("cell");
    await expect(cells("Seats")).toHaveText(["Seats", "2", "2"]);
    await expect(cells("Strokes")).toHaveText(["Strokes", String(Math.max(s3.strokes, s7.strokes)), String(Math.max(s2.strokes, s6.strokes))]);
    await expect(cells("Avg split")).toHaveText(["Avg split", "2:05.0", "—"]);
    await expect(cells("Avg peak")).toHaveText(["Avg peak", fmt((s3.avgPeak + s7.avgPeak) / 2), fmt((s2.avgPeak + s6.avgPeak) / 2)]);
    await expect(page.getByRole("button", { name: "Heading up" })).toHaveCount(1);
    await expect(page.getByText("No GPS track: that comes from Vieve.")).toHaveCount(1);

    await page.getByLabel("First").selectOption(older);
    await expect(page).toHaveURL(new RegExp(`a=${older}`));
    await expect(cells("Avg peak")).toHaveText(["Avg peak", fmt((s2.avgPeak + s6.avgPeak) / 2), fmt((s2.avgPeak + s6.avgPeak) / 2)]);
    await expect(cells("Avg split")).toHaveText(["Avg split", "—", "—"]);
    await page.getByLabel("Second").selectOption("");
    await expect(page.getByRole("heading", { name: "Nothing picked" })).toBeVisible();
    await expect(cells("Seats")).toHaveText(["Seats", "2", "—"]);
  });

  test("the history chart draws each seat across its sessions, one measure at a time", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const earlier = Object.entries(await longSeat(2, 100)).map(([name, bytes]) => ({ name, mimeType: "application/octet-stream", buffer: Buffer.from(bytes) }));
    await upload(page, earlier, "2026-03-01T09:00");
    await page.goto("/app/force");
    // One session is no history yet.
    await expect(page.getByRole("heading", { name: "Seat by seat, over time" })).toHaveCount(0);

    await upload(page, await crewZip(2, 6), "2026-03-08T09:00");
    await page.goto("/app/force");
    await expect(page.getByRole("heading", { name: "Seat by seat, over time" })).toBeVisible();
    await expect(page.getByText(/Every session with a seat set, by seat\..*\(3 sessions\)/)).toBeVisible();
    const chart = page.getByRole("img", { name: "Peak by seat, across 3 sessions." });
    await expect(chart).toBeVisible();

    // Seat 2's line runs from its first session at the left edge to its second
    // at the right; seat 6 has only the second.
    const drawn = () =>
      chart.evaluate((el) => {
        const canvas = el as HTMLCanvasElement;
        const dpr = canvas.width / canvas.clientWidth;
        const { data, width, height } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
        const span = ([r, g, b]: number[]) => {
          let from = Infinity;
          let to = -Infinity;
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const i = (y * width + x) * 4;
              if (data[i + 3] > 200 && Math.abs(data[i] - r) < 16 && Math.abs(data[i + 1] - g) < 16 && Math.abs(data[i + 2] - b) < 16) {
                from = Math.min(from, x);
                to = Math.max(to, x);
              }
            }
          }
          return { from: from / dpr / canvas.clientWidth, to: to / dpr / canvas.clientWidth };
        };
        // The first two of the chart's colours, in seat order.
        return { two: span([0x22, 0xe3, 0xef]), six: span([0x3d, 0xdc, 0x6e]) };
      });
    await expect.poll(async () => (await drawn()).two.from).toBeLessThan(0.25);
    const { two, six } = await drawn();
    expect(two.to).toBeGreaterThan(0.75);
    expect(six.from).toBeGreaterThan(0.75);

    const legend = page.getByRole("listitem").filter({ hasText: /^seat \d$/ });
    await expect(legend).toHaveText(["seat 2", "seat 6"]);
    await page.getByRole("button", { name: "Consistency" }).click();
    await expect(page.getByRole("button", { name: "Consistency" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Peak", exact: true })).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("img", { name: "Consistency by seat, across 3 sessions." })).toBeVisible();
  });

  // The layout's check runs once per page load, so a page left open after
  // someone is taken off the beta list still has its buttons. Delete's message
  // comes only from the action's own viewer check, so that half proves it; the
  // side half only proves the write is refused, which RLS would do on its own.
  test("taken off the beta list, a page left open can't set a side or delete", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    const crew = await upload(page, await crewZip(2, 6));
    const outing = await context.newPage();
    await outing.goto(`/app/cox/${crew}`);
    await expect(outing.getByRole("heading", { name: "Port and starboard" })).toBeVisible();
    await revoke(user.email);

    await outing.getByRole("listitem").filter({ hasText: "seat 2" }).getByRole("button", { name: "P" }).click();
    await expect(outing.getByRole("alert").filter({ hasText: "That side wasn't saved. Try again in a minute." })).toBeVisible();
    await expect(outing.getByRole("listitem").filter({ hasText: "seat 2" }).getByRole("button", { name: "P" })).toHaveAttribute("aria-pressed", "false");

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete session" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Sign in with a beta account to delete a session." })).toBeVisible({ timeout: 30_000 });

    // A fresh load says why.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The dashboard is for beta crews.");
    await expect(page.getByText(user.email)).toBeVisible();
    await expect(page.getByRole("link", { name: "Apply for the beta" })).toHaveAttribute("href", "/beta");
    await expect(page.getByRole("link", { name: "Apply for the beta" })).toHaveAttribute("data-cta", "app");

    await allow(user.email);
    const { data: rows } = await user.db.from("sessions").select("id, side");
    expect(rows).toHaveLength(3);
    expect(rows?.every((r) => r.side === null)).toBe(true);
  });
});
