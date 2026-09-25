import { test, expect, type Locator } from "@playwright/test";
import { expectSkipLink } from "./support/skip-link";
import { contactEmail, googleSignIn } from "../lib/owner";

test("the marketing page renders, with the beta offered in four places", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The force curve from every seat in the boat.");
  // The node and its screen are drawn by the server, not fetched as a picture.
  await expect(page.getByRole("img", { name: /Force seat node/i }).first()).toBeVisible();
  await expect(page.locator("#hero-peak")).toHaveCount(1);

  for (const id of ["crew", "how", "stroke", "products", "beta-scope", "faq", "beta"]) {
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  }

  // Vieve is named, and named properly on first mention.
  await expect(page.locator("#crew")).toContainText("Vieve, the RowTech cox box");
  await expect(page.locator("#faq")).toContainText("Vieve");
  // The Force page has no calibrated numbers to point to yet (BIZ-013).
  await expect(page.locator("#faq")).toContainText("The Force page says where calibration stands.");

  // The beta is offered in the nav, the hero, once mid-page and at the close.
  const froms = await page
    .getByRole("link", { name: /apply for the beta/i })
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-cta")));
  expect(froms.sort()).toEqual(["closing", "hero", "nav", "stroke"]);

  // Built and planned are kept apart.
  await expect(page.locator("#beta-scope")).toContainText("In the node’s firmware now");
});

// The home page's copy says the same as the form and the dashboard (CNT-003).
test("the home page agrees with the beta form and the dashboard", async ({ page }) => {
  await page.goto("/");
  // The dashboard's words for the two sides of the boat.
  await expect(page.locator("#crew")).toContainText("port and starboard");
  // The form's optional questions, the role among them.
  await expect(page.locator("#beta")).toContainText("Your role, which boats you row, where you are and a note are optional.");
  // A node writes four files: the three drawn in step 3, and a meta file.
  await expect(page.locator("#beta-scope")).toContainText("three data files and a meta file");
  await page.goto("/beta");
  await expect(page.locator("form summary")).toContainText("Tell us about your boats");
});

// What a node saves and you download is a session, as the dashboard calls it;
// what was rowed is an outing (CNT-002).
test("the site calls what you download from a node a session", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#how")).toContainText("Download the session");
  await expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText("You download the session at the dock.");
  for (const path of ["/", "/force"]) {
    await page.goto(path);
    await expect(page.locator("main"), path).not.toContainText(/\bpractice\b/i);
  }
});

test("specifications live on the product pages, not the home page", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).not.toContainText("3000 mAh");
  await expect(page.locator("main")).not.toContainText("$499");
  await expect(page.locator("#products").getByRole("link", { name: /Force/ })).toHaveAttribute("href", "/force");
  await expect(page.locator("#products").getByRole("link", { name: /Vieve/ })).toHaveAttribute("href", "/vieve");

  await page.goto("/force");
  await expect(page.locator("#specs")).toContainText("3000 mAh");
  await page.goto("/vieve");
  await expect(page.locator("#specs")).toContainText("$499");
  // The target price is a spec, not the pitch in the lead (CNT-021).
  await expect(page.locator("main section").first()).not.toContainText("$499");
});

// Claims no stronger than what's built (LEG-010): no "any phone", and Vieve's
// parts are planned. The 3 ms line keeps the site's own wording until the
// owner says what it measures.
test("the specifications claim no more than what's built", async ({ page }) => {
  await page.goto("/force");
  const force = page.locator("#specs");
  await expect(force).not.toContainText("any phone");
  await page.goto("/vieve");
  for (const row of ["Screen", "GPS", "Battery"]) {
    await expect(page.locator("#specs dt", { hasText: row }).locator("+ dd")).toContainText(/^Planned/);
  }
});

// One style for numbers and units (CNT-007): no cell ends in a full stop, a
// rate is in Hz, and a percent sign sits against its number.
test("the specifications and the stroke chart write numbers one way", async ({ page }) => {
  for (const path of ["/force", "/vieve"]) {
    await page.goto(path);
    for (const cell of await page.locator("#specs dd").allTextContents()) {
      expect(cell.trim(), `${path}: ${cell}`).not.toMatch(/\.$/);
    }
    await expect(page.locator("#specs")).not.toContainText("a second");
  }
  await page.goto("/");
  const chart = page.locator("#stroke");
  await expect(chart).not.toContainText(/\d %/);
  await expect(chart).not.toContainText(" & ");
});

// The questions a coach asks about Force have a row in its specifications,
// even while the answer is still to come (BIZ-004, BIZ-008, BIZ-022), and the
// longer rows wrap on a phone instead of widening the page.
test("Force's specifications say what it fits, what it doesn't measure and its target price", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/force");
  const labels = await page.locator("#specs dt").allTextContents();
  for (const label of ["Fits", "Doesn’t measure", "Target price"]) expect(labels).toContain(label);
  for (const label of ["Fits", "Doesn’t measure", "Target price"]) {
    await expect(page.locator("#specs dt", { hasText: label }).locator("+ dd")).not.toBeEmpty();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // The Fits row and the home page's fit question give the same answer.
  await expect(page.locator("#specs dt", { hasText: "Fits" }).locator("+ dd")).toContainText("Vespoli riggers");
  await page.goto("/vieve");
  await expect(page.locator("#specs dt", { hasText: "Target price" })).toHaveCount(1);
  await page.goto("/");
  await expect(page.locator("#faq")).toContainText("For now it fits Vespoli riggers");
});

// The build status and how the beta works sit under their headings, and what
// happens when a unit fails is one of what beta crews get, with the site's one
// contact to write to (BIZ-014, BIZ-017, BIZ-020).
test("the home page has a line for the build status, how the beta works, and failed units", async ({ page }) => {
  await page.goto("/");
  for (const id of ["beta-scope", "beta"]) {
    await expect(page.locator(`#${id} h2 + p`)).not.toBeEmpty();
  }
  const get = page.locator("#beta h3", { hasText: "What beta crews get" }).locator("+ ul > li");
  await expect(get).toHaveCount(4);
  await expect(get.last()).toContainText(`Write to ${contactEmail}.`);
});

// Another company sells rowing sensors as RowTech Solutions; the FAQ says this
// RowTech isn't it (BIZ-023: the name stays).
test("the FAQ says RowTech isn't RowTech Solutions", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#faq summary", { hasText: "Are you RowTech Solutions?" })).toHaveCount(1);
  await expect(page.locator("#faq")).toContainText("isn’t connected to RowTech Solutions");
});

// "Wi-Fi", the standard spelling, wherever a page says it (LEG-016, CNT-008).
test("Wi-Fi is spelled Wi-Fi on the pages", async ({ page }) => {
  for (const path of ["/", "/force", "/vieve"]) {
    await page.goto(path);
    const text = (await page.locator("body").textContent()) ?? "";
    expect(text, path).not.toContain("WiFi");
  }
  await page.goto("/");
  await expect(page.locator("#how")).toContainText("the node’s own Wi-Fi");
  await expect(page.locator("#faq summary", { hasText: "Wi-Fi at the boathouse" })).toHaveCount(1);
  // "Force" at the start of a sentence reads as the product, not the quantity.
  await expect(page.locator("#faq")).toContainText("Force readings do:");
  await page.goto("/force");
  await expect(page.locator("#boathouse dt", { hasText: "Its own Wi-Fi network" })).toHaveCount(1);
  await expect(page.locator("#specs dt", { hasText: "Network" }).locator("+ dd")).toContainText("Wi-Fi");
  await expect(page.locator("#parts")).toContainText("its own Wi-Fi network");
});

// The copy is written for US coaches in US spelling, and so is what a screen
// reader reads out of the drawings (CNT-017).
test("the pages use US spelling, in their text and their labels", async ({ page }) => {
  const british = /\b(coloured|colours?|metres?|kilometres?|centred|centre|programmes?|analysed?)\b/i;
  for (const path of ["/", "/force", "/vieve", "/beta"]) {
    await page.goto(path);
    const text = (await page.locator("body").textContent()) ?? "";
    const labels = await page.locator("[aria-label]").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
    for (const said of [text, ...labels]) expect(said.match(british)?.[0] ?? null, path).toBeNull();
  }
  await page.goto("/vieve");
  await expect(page.locator('[aria-label*="per 500 meters"]').first()).toBeAttached();
});

// No node has been calibrated: the kilograms on the home page say they're an
// example, next to where they're shown (BIZ-005).
test("the home page's kilograms are labelled as example data, with where calibration stands", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator('[data-section="hero"]');
  await expect(hero.locator("figcaption").filter({ has: page.getByRole("link", { name: "See Force" }) })).toContainText(/example data/i);
  await expect(hero.locator("figcaption").filter({ hasText: "Example stroke" })).toContainText("calibrated a node yet");
  await expect(page.locator("#stroke")).toContainText("Until a node is calibrated, force reads in raw sensor units.");
  // Step 2 and the Force product card draw the same screen (LEG-010).
  await expect(page.locator("#how figure figcaption")).toContainText(/example data/i);
  await expect(page.locator("#products li").filter({ hasText: "Force, the seat node" })).toContainText(/example data/i);
  // The Force page's model shows the same screen (LEG-010).
  await page.goto("/force");
  await expect(page.locator("#parts figcaption")).toContainText(/example data/i);
});

test("reduced motion leaves the pages in their finished state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".rt-stroke-cursor")).toBeHidden();
  // The hero curve is drawn up to the next catch, where the node wipes it,
  // and holds still there.
  const strip = await page.locator(".rt-stroke-reveal").evaluate((el) => {
    const box = el.parentElement!.getBoundingClientRect();
    const win = el.getBoundingClientRect();
    const curve = el.querySelector("svg")!.getBoundingClientRect();
    return { edge: (win.right - box.left) / box.width, curve: [curve.left - box.left, curve.width - box.width] };
  });
  expect(strip.edge).toBeGreaterThan(0.85);
  expect(strip.edge).toBeLessThan(0.95);
  for (const d of strip.curve) expect(Math.abs(d)).toBeLessThan(1);
  await expect(page.locator(".rt-stroke-reveal")).toHaveCSS("animation-name", "none");
  await page.goto("/vieve");
  await expect(page.locator("#clock")).toContainText("8 of 8");
  // The 3D model still comes up; it goes straight to each view instead of turning.
  await page.locator("#parts").getByRole("button", { name: "Show the 3D model" }).click();
  await expect(page.getByRole("application", { name: "3D model: Parts of Vieve" }).locator("canvas")).toBeVisible({ timeout: 15000 });
});

// The hero's curve sweeps by moving layers, never by repainting them (LEAD-008).
test("the hero curve sweeps with transforms alone", async ({ page }) => {
  await page.goto("/");
  const animated = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => (a.effect as KeyframeEffect).target?.matches(".rt-stroke-reveal, .rt-stroke-hold, .rt-stroke-cursor"))
      .map((a) => {
        const props = (a.effect as KeyframeEffect)
          .getKeyframes()
          .flatMap((k) => Object.keys(k).filter((p) => !["offset", "computedOffset", "easing", "composite"].includes(p)));
        return `${(a as CSSAnimation).animationName}: ${[...new Set(props)].join(", ")}`;
      })
      .sort()
  );
  expect(animated).toEqual(["rt-stroke-cursor: transform", "rt-stroke-hold: transform", "rt-stroke-reveal: transform"]);
});

// The hero screen replays the page's example stroke, so its stroke counter
// says 147 as the rest of the page and the share image do (LEAD-007).
// It changes the big number's text in place: replacing the text node instead
// restyles the whole page on every frame (PERF-003).
test("the hero screen runs through a stroke and its counter stays at 147", async ({ page }) => {
  await page.goto("/");
  type Seen = { __peak: string[] };
  await page.evaluate(() => {
    const seen: string[] = ((window as unknown as Seen).__peak = []);
    const peak = document.getElementById("hero-peak")!;
    new MutationObserver((ms) => seen.push(...ms.map((m) => m.type))).observe(peak, { childList: true, characterData: true, subtree: true });
  });
  // The screen comes up with a finished stroke; the next drive clears the
  // peak, which then climbs back to the stroke's own.
  await page.waitForFunction(() => document.getElementById("hero-peak")?.textContent !== "61.4", null, { timeout: 15000 });
  await page.waitForFunction(() => document.getElementById("hero-peak")?.textContent === "61.4", null, { timeout: 15000 });
  const screen = page.locator("#hero-peak").locator("xpath=ancestor::*[local-name()='svg'][1]");
  await expect(screen).toContainText(/STROKE\s*147(?!\d)/);
  const seen = await page.evaluate(() => (window as unknown as Seen).__peak);
  expect(seen).toContain("characterData");
  expect(seen).not.toContain("childList");
});

// The hero screen holds still until the page has loaded and the browser is
// idle (PERF-003). Idle callbacks are held back here, so the screen must not
// move after load until they are let go.
test("the hero screen waits for load and an idle moment before it moves", async ({ page }) => {
  type Win = { __idle: (() => void)[]; __moves: { loaded: boolean }[]; __loaded: boolean };
  await page.addInitScript(() => {
    const w = window as unknown as Win;
    w.__idle = [];
    w.__moves = [];
    w.__loaded = false;
    addEventListener("load", () => (w.__loaded = true));
    // Held, not run: the test lets them go.
    window.requestIdleCallback = ((cb: IdleRequestCallback) => {
      w.__idle.push(() => cb({ didTimeout: false, timeRemaining: () => 50 }));
      return w.__idle.length;
    }) as typeof window.requestIdleCallback;
    window.cancelIdleCallback = () => {};
    // Only what the animator writes: the parser's own insertions are childList.
    const ids = ["hero-sweep", "hero-cursor", "hero-peak"];
    new MutationObserver((ms) => {
      for (const m of ms) {
        const el = m.target instanceof Element ? m.target : m.target.parentElement;
        if (el && ids.some((id) => el.closest(`#${id}`))) w.__moves.push({ loaded: w.__loaded });
      }
    }).observe(document, { subtree: true, attributes: true, characterData: true });
  });
  await page.goto("/");
  await page.waitForFunction(() => (window as unknown as Win).__loaded);
  // Longer than a whole stroke: an animator that had started would have moved.
  await page.waitForTimeout(3000);
  expect(await page.evaluate(() => (window as unknown as Win).__moves.length)).toBe(0);

  await page.evaluate(() => {
    const w = window as unknown as Win;
    for (const run of w.__idle.splice(0)) run();
  });
  await page.waitForFunction(() => (window as unknown as Win).__moves.length > 0, null, { timeout: 10000 });
  const moves = await page.evaluate(() => (window as unknown as Win).__moves);
  expect(moves.every((m) => m.loaded)).toBe(true);
});

test("the Force page shows the node as a 3D model with its notes around it", async ({ page }) => {
  await page.goto("/force");
  const figure = page.locator("#parts figure");
  await figure.scrollIntoViewIfNeeded();
  // Until it's asked for, the drawing of the node stands in, with no hint to drag it.
  await expect(figure.getByRole("img", { name: /Force seat node/ })).toBeVisible();
  await expect(figure).not.toContainText("Drag the model");
  await figure.getByRole("button", { name: "Show the 3D model" }).click();
  const model = page.getByRole("application", { name: "3D model: Parts of the Force node" });
  await expect(model.locator("canvas")).toBeVisible({ timeout: 15000 });
  await expect(figure).toContainText("Drag the model, or use the arrow keys, to turn it.");
  await expect(figure.getByRole("img", { name: /Force seat node/ })).toHaveCount(0);
  await expect(page.locator("#parts")).toContainText("Steps through the rower’s screens");
  // VIEW and TARE have notes. POWER has none until what it does is confirmed (CNT-003).
  const notes = page.getByRole("list", { name: "Parts of the Force node" });
  for (const key of ["VIEW", "TARE"]) await expect(notes.getByRole("button", { name: new RegExp(key) })).toHaveCount(1);
});

// three.js is a quarter of a megabyte gzipped: only fetched when someone
// reaches for the model, not because the page loaded (PERF-001).
test("the 3D model's code loads when someone reaches for it, not with the page", async ({ page }) => {
  const scripts: Array<Promise<string>> = [];
  page.on("response", (r) => {
    if (r.url().endsWith(".js")) scripts.push(r.text().catch(() => ""));
  });
  const three = async () => (await Promise.all(scripts)).some((t) => t.includes("WebGLRenderer"));

  await page.goto("/force", { waitUntil: "networkidle" });
  await page.locator("#parts figure").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  expect(await three()).toBe(false);
  await expect(page.locator("#parts canvas")).toHaveCount(0);

  // Pointing at it is enough.
  await page.locator("#parts figure").getByRole("img", { name: /Force seat node/ }).hover();
  await expect(page.locator("#parts canvas")).toBeVisible({ timeout: 15000 });
  expect(await three()).toBe(true);
});

// The model is a widget that takes the arrow keys, and says so (A11Y-007).
test("from the keyboard, the 3D model says it takes the arrow keys, and does", async ({ page }) => {
  await page.goto("/vieve");
  const show = page.locator("#parts").getByRole("button", { name: "Show the 3D model" });
  await show.focus();
  await page.keyboard.press("Enter");
  const model = page.getByRole("application", { name: "3D model: Parts of Vieve" });
  // The button goes; focus goes on to the model instead of being dropped.
  await expect(model).toBeFocused({ timeout: 15000 });
  await expect(model).toHaveAccessibleDescription("Drag the model, or use the arrow keys, to turn it.");
  // The name and the keys are the stage's; the canvas is hidden from screen readers.
  await expect(model.locator('[aria-hidden="true"] canvas')).toHaveCount(1);
  // Taking focus may scroll the model into view (smoothly): let that finish,
  // then an arrow key turns the model instead of scrolling the page.
  const settled = async () => {
    const a = await page.evaluate(() => scrollY);
    await page.waitForTimeout(250);
    return a === (await page.evaluate(() => scrollY));
  };
  await expect.poll(settled).toBe(true);
  const y = await page.evaluate(() => scrollY);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => scrollY)).toBe(y);
});

// Reaching the button isn't pressing it: focus stays put, and nothing loads (A11Y-007).
test("tabbing onto 'Show the 3D model' leaves focus there and loads nothing", async ({ page }) => {
  const scripts: Array<Promise<string>> = [];
  page.on("response", (r) => {
    if (r.url().endsWith(".js")) scripts.push(r.text().catch(() => ""));
  });
  const three = async () => (await Promise.all(scripts)).some((t) => t.includes("WebGLRenderer"));

  await page.goto("/force", { waitUntil: "networkidle" });
  const show = page.locator("#parts").getByRole("button", { name: "Show the 3D model" });
  await show.focus();
  await page.waitForTimeout(2000);
  await expect(show).toBeFocused();
  await expect(page.locator("#parts canvas")).toHaveCount(0);
  expect(await three()).toBe(false);
});

// Pressing it and then going elsewhere before the model is there: focus isn't
// pulled back to the model when it arrives (A11Y-007).
test("focus isn't pulled back to the 3D model once it has moved on", async ({ page }) => {
  await page.goto("/vieve", { waitUntil: "networkidle" });
  // Slow the model's code, so there is time to move on.
  await page.route("**/_next/static/chunks/**", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  const show = page.locator("#parts").getByRole("button", { name: "Show the 3D model" });
  await show.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { level: 1 }).click();
  const model = page.getByRole("application", { name: "3D model: Parts of Vieve" });
  await expect(model.locator("canvas")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(250);
  await expect(model).not.toBeFocused();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("the product pages show the device drawings, and nothing to drag", async ({ page }) => {
    for (const [path, name] of [["/force", /Force seat node/], ["/vieve", /Vieve V1/]] as const) {
      await page.goto(path);
      const figure = page.locator("#parts figure");
      await expect(figure.getByRole("img", { name })).toBeVisible();
      await expect(figure).not.toContainText("Drag the model");
      await expect(figure.getByRole("button", { name: /3D model/ })).toHaveCount(0);
      await expect(figure.locator("ol:visible").first()).toContainText("Screen");
    }
  });
});

test("without WebGL, the drawing stays and the page keeps working", async ({ playwright, baseURL }) => {
  const browser = await playwright.chromium.launch({ args: ["--disable-webgl", "--disable-3d-apis"] });
  try {
    const page = await browser.newPage({ baseURL });
    await page.goto("/force");
    const figure = page.locator("#parts figure");
    await figure.scrollIntoViewIfNeeded();
    await figure.getByRole("button", { name: "Show the 3D model" }).focus();
    await page.keyboard.press("Enter");
    // The scene can't start: the offer goes, the drawing stays.
    await expect(figure.getByRole("button", { name: /3D model/ })).toHaveCount(0, { timeout: 15000 });
    // Focus went with the button: it moves on to the first note, not to the top of the page.
    await expect(figure.locator("ol:visible button").first()).toBeFocused();
    await expect(figure.getByRole("img", { name: /Force seat node/ })).toBeVisible();
    await expect(figure).not.toContainText("Drag the model");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Force, the seat node.");
  } finally {
    await browser.close();
  }
});

test("there is no team page for now, and old links to it go home", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Who we are" })).toHaveCount(0);
  // Temporary (307), not permanent: the page is coming back.
  const res = await request.get("/team", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toBe("/");
  await page.goto("/team");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The force curve from every seat in the boat.");
});

// The synthetic sample session is test data: served from the site, its
// meta.json would claim a calibrated node (CNT-010).
test("the synthetic sample session isn't served from the site", async ({ request }) => {
  for (const f of ["meta.json", "strokes.csv", "curves.bin", "events.csv"]) {
    expect((await request.get(`/demo/seat-1/${f}`, { maxRedirects: 0 })).status(), f).toBe(404);
  }
});

test("an address the site doesn't have gets the site's own 404", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  // One title, and it says what happened.
  await expect(page.locator("title")).toHaveCount(1);
  await expect(page).toHaveTitle("Page not found · RowTech");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  // The site's header, a main landmark and ways back in.
  await expect(page.getByRole("banner").getByRole("link", { name: "RowTech home" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toHaveCount(1);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Page not found.");
  for (const [name, href] of [["Home", "/"], ["Force", "/force"], ["Vieve", "/vieve"]]) {
    await expect(main.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  }
  await expect(main.getByRole("link", { name: /apply for the beta/i })).toHaveAttribute("href", "/beta");
  await expect(main.getByRole("link", { name: /apply for the beta/i })).toHaveAttribute("data-cta", "not-found");
  // Dark, like the rest of the site, not the framework's white default.
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe("rgb(255, 255, 255)");
});

test("the diagrams light the part a note describes", async ({ page }) => {
  await page.goto("/force");
  await page.locator("#parts figure").first().scrollIntoViewIfNeeded();
  const note = page.getByRole("list", { name: "Parts of the Force node" }).getByRole("button", { name: /TARE/ });
  await note.click();
  await expect(note).toHaveAttribute("aria-pressed", "true");
});

test("picking a measure on the stroke chart shows what it is", async ({ page }) => {
  await page.goto("/");
  const chart = page.locator("#stroke");
  await chart.scrollIntoViewIfNeeded();
  // Wide screens: the callouts on the chart. Phones: the chips under it.
  const rise = chart.getByRole("button", { name: /Rise rate/ });
  // The server's copy is static; the live one swaps in as it comes into view.
  await expect(async () => {
    await rise.click();
    await expect(rise).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
  }).toPass({ timeout: 10000 });
  await expect(chart.getByRole("button", { name: /Catch/ })).toHaveAttribute("aria-pressed", "false");
  await expect(chart.locator('[aria-live="polite"]')).toContainText("How quickly the blade loads");
  // Passing the mouse over another measure doesn't pick it (LEAD-010).
  await chart.getByRole("button", { name: /Catch/ }).hover();
  await page.waitForTimeout(300);
  await expect(rise).toHaveAttribute("aria-pressed", "true");
  await expect(chart.locator('[aria-live="polite"]')).toContainText("How quickly the blade loads");
});

// Each measure is one control, and one Tab stop, at any width: on a phone the
// chips, with the numbered markers left to pointing (A11Y-006). A control's
// accessible name is the words it shows (SEO-013).
test("the stroke chart offers each measure once, named as it reads", async ({ page }) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const chart = page.locator("#stroke");
    await chart.scrollIntoViewIfNeeded();
    const buttons = chart.getByRole("button");
    await expect(buttons, `${width}px`).toHaveCount(7);
    // Tab through the live copy, not the server's, which it replaces.
    await expect(async () => {
      await buttons.last().click();
      await expect(buttons.last()).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
    }).toPass({ timeout: 10000 });
    for (const b of await buttons.all()) {
      const shown = (await b.innerText()).replace(/\s+/g, " ").trim();
      await expect(b, `${width}px`).toHaveAccessibleName(shown);
    }
    await chart.getByRole("heading", { level: 2 }).evaluate((h) => {
      h.tabIndex = -1;
      h.focus();
    });
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press("Tab");
      await expect(buttons.nth(i), `${width}px, Tab ${i + 1}`).toBeFocused();
    }
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus"), `${width}px, past the measures`).not.toHaveRole("button");
  }
});

// The threshold's label clears every marker and callout: the numbered markers
// on a phone, and the named callouts the chart shrinks under from sm up to lg
// (FMT-002). On a phone the seventh chip takes a row of its own rather than
// half of one (FMT-003).
test("on a phone, the stroke chart's label and chips sit clear", async ({ page }) => {
  for (const width of [375, 640, 768]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/");
    const chart = page.locator("#stroke");
    await chart.scrollIntoViewIfNeeded();
    // Measure the live copy, not the server's, which it replaces.
    const catchChip = chart.getByRole("button", { name: /Catch/ });
    await expect(async () => {
      await chart.getByRole("button", { name: /Rise rate/ }).click();
      await catchChip.click();
      await expect(catchChip).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
    }).toPass({ timeout: 10000 });
    const label = (await chart.locator("text", { hasText: "catch threshold" }).boundingBox())!;
    for (const marker of await chart.locator("button:visible").all()) {
      const m = (await marker.boundingBox())!;
      const apart = m.x + m.width <= label.x || label.x + label.width <= m.x || m.y + m.height <= label.y || label.y + label.height <= m.y;
      expect(apart, `${width}px, ${await marker.textContent()}`).toBe(true);
    }
    if (width === 375) {
      const list = chart.getByRole("list", { name: "Stroke metrics" });
      const last = (await list.getByRole("listitem").last().boundingBox())!;
      expect(last.width).toBeCloseTo((await list.boundingBox())!.width, 0);
    }
  }
});

// The crew view scrolls sideways on a phone, and is a Tab stop so the
// keyboard can scroll it; where it fits, it isn't one (A11Y-008).
test("the crew view is a Tab stop only while it scrolls", async ({ page }) => {
  const region = page.getByRole("region", { name: /^Crew view illustration/ });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await region.scrollIntoViewIfNeeded();
  await expect(region).toHaveAttribute("tabindex", "0");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(region).not.toHaveAttribute("tabindex");
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(region).toHaveAttribute("tabindex", "0");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("the crew view is a Tab stop, since it may scroll", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("region", { name: /^Crew view illustration/ })).toHaveAttribute("tabindex", "0");
  });
});

test("the Vieve page shows it as a 3D model too", async ({ page, isMobile }) => {
  await page.goto("/vieve");
  const figure = page.locator("#parts figure");
  await figure.scrollIntoViewIfNeeded();
  const drawing = figure.getByRole("img", { name: /Vieve V1/ });
  await expect(drawing).toBeVisible();
  // A tap or a click on the drawing is enough.
  await (isMobile ? drawing.tap() : drawing.click());
  const model = page.getByRole("application", { name: "3D model: Parts of Vieve" });
  await expect(model.locator("canvas")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#parts")).toContainText("concept design");
});

test("no page can be framed, and responses carry the basic security headers", async ({ request }) => {
  for (const path of ["/", "/beta", "/force", "/app/login", "/icon.svg"]) {
    const res = await request.get(path);
    const h = res.headers();
    expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"], path).toBe("DENY");
    expect(h["x-content-type-options"], path).toBe("nosniff");
    expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"], path).toContain("camera=()");
    expect(h["strict-transport-security"], path).toBe("max-age=63072000; includeSubDomains; preload");
    expect(h["x-powered-by"], path).toBeUndefined();
  }
});

// The icons and the share image are checked once a day, not on every page
// view (PERF-008).
test("the icons and the share image are cached for a day", async ({ request }) => {
  for (const path of ["/icon.svg", "/favicon.ico", "/apple-icon.png", "/og.png"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()["cache-control"], path).toBe("public, max-age=86400, stale-while-revalidate=604800");
    expect(res.headers()["x-frame-options"], path).toBe("DENY");
  }
});

// Archivo sets the headline and is preloaded; Chivo Mono is for device output
// only and loads when a page uses it (PERF-006).
test("only the headline font is preloaded", async ({ request }) => {
  for (const path of ["/", "/beta", "/force"]) {
    const html = await (await request.get(path)).text();
    const fonts = html.match(/<link[^>]*rel="preload"[^>]*as="font"[^>]*>/g) ?? [];
    expect(fonts, path).toHaveLength(1);
  }
});

// A link to a section on the home page reads as that section's heading does,
// so landing there confirms the jump (UX-011).
test("header and footer links to home page sections use their headings' words", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const links = page.locator('header nav a[href^="/#"], footer nav a[href^="/#"]');
  expect(await links.count()).toBeGreaterThanOrEqual(5);
  for (const link of await links.all()) {
    const label = (await link.textContent())!.trim();
    const id = (await link.getAttribute("href"))!.slice(2);
    const heading = (await page.locator(`#${id} h2`).first().textContent())!.toLowerCase();
    for (const word of label.toLowerCase().split(/\s+/)) expect(heading, `${label} -> #${id}`).toContain(word);
  }
});

// The home page's sections must have their real height from the start, or a
// link to one of them lands where the section would have been (UX-001).
test("links to the FAQ land on the FAQ", async ({ page, isMobile }) => {
  const faq = page.locator("#faq");
  // Distance between the section's top and the header's offset, once the
  // scroll has stopped moving (smooth scrolling passes through on its way).
  const offTarget = () =>
    faq.evaluate(async (el) => {
      const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
      const a = el.getBoundingClientRect().top;
      await new Promise((r) => setTimeout(r, 300));
      const b = el.getBoundingClientRect().top;
      return a === b ? Math.abs(b - pad) : Infinity;
    });
  const landsOnFaq = async () => {
    await expect.poll(offTarget, { timeout: 10000 }).toBeLessThanOrEqual(2);
    await expect(faq.getByRole("heading", { level: 2 })).toBeInViewport();
  };
  const clickFaq = async () => {
    const header = page.locator("header");
    if (isMobile) await header.getByText("Menu", { exact: true }).click();
    await header.getByRole("link", { name: "Questions", exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/#faq$/);
  };

  await page.goto("/#faq");
  await landsOnFaq();

  await page.goto("/");
  await clickFaq();
  await landsOnFaq();

  await page.goto("/force");
  await clickFaq();
  await landsOnFaq();
});

// Keyboard users get past the header's links in one step (A11Y-001).
test("the first Tab on every page is a link past the header to the content", async ({ page }) => {
  for (const path of ["/", "/beta", "/force", "/vieve", "/no-such-page", "/app/login"]) {
    await page.goto(path);
    await test.step(path, () => expectSkipLink(page));
  }
});

// A click on text in the page and then Tab goes on from there, not back to the
// top of <main> (A11Y-001).
test("Tab after a click on text in the page goes on from where the click was", async ({ page }) => {
  for (const [path, heading] of [["/force", "#specs h2"], ["/", "#faq h2"]] as const) {
    await page.goto(path);
    await test.step(path, async () => {
      const h2 = page.locator(heading);
      await h2.click();
      expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("MAIN");
      await page.keyboard.press("Tab");
      expect(
        await h2.evaluate((el) => !!(el.compareDocumentPosition(document.activeElement!) & Node.DOCUMENT_POSITION_FOLLOWING)),
      ).toBe(true);
    });
  }
});

// The phone menu behaves like one: it says whether it's open, and a change of
// mind closes it, whichever way it comes (UX-004, A11Y-004). Its panel stays
// on a 375px screen (FMT-001).
test("the phone menu closes on Escape, a tap outside, a scroll or a Tab out, and fits the screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const menu = page.getByRole("banner").getByRole("button", { name: "Menu", exact: true });
  const panel = page.locator("header details nav");
  const isOpen = async () => {
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toBeVisible();
  };
  const isClosed = async () => {
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();
  };

  await isClosed();
  await expect(menu).toHaveAttribute("aria-controls", (await panel.getAttribute("id"))!);
  await menu.click();
  await isOpen();
  const box = (await panel.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);

  // Escape, from a link in the menu, hands focus back to "Menu".
  await panel.getByRole("link", { name: "Force", exact: true }).focus();
  await page.keyboard.press("Escape");
  await isClosed();
  await expect(menu).toBeFocused();

  await menu.click();
  await isOpen();
  await page.getByRole("heading", { level: 1 }).click({ position: { x: 5, y: 5 } });
  await isClosed();

  // From the keyboard: Tab past the last link goes on to the header's CTA,
  // and the menu doesn't stay open behind it.
  await menu.focus();
  await page.keyboard.press("Enter");
  await isOpen();
  for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
  await expect(panel.getByRole("link", { name: "Questions" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator('header a[data-cta="nav"]')).toBeFocused();
  await isClosed();

  // The page moving under it closes it too.
  await menu.click();
  await isOpen();
  await page.evaluate(() => window.scrollBy(0, 300));
  await isClosed();
});

// Opened before the page's scripts have run, the menu still says so once they
// have, and closes on Escape like any other time.
test("the phone menu opened before hydration still says it's open, and closes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route(/\/_next\/static\/.*\.js/, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const summary = page.locator("header summary");
  const panel = page.locator("header details nav");
  await summary.click();
  await expect(panel).toBeVisible();
  await expect(summary).not.toHaveAttribute("aria-controls");
  release();
  // aria-controls appears once the component has hydrated.
  await expect(summary).toHaveAttribute("aria-controls", /.+/, { timeout: 15000 });
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(summary).toHaveAttribute("aria-expanded", "false");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("the phone menu still opens, on the screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.locator("header summary").click();
    const panel = page.locator("header details nav");
    await expect(panel.getByRole("link", { name: "Questions" })).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
  });
});

// On a phone, the small links and buttons take taps over at least 44x44 CSS
// px, however small they're drawn (A11Y-005): every point of the target's
// middle 42px square lands on it.
async function tapArea(target: Locator) {
  return target.evaluate((el) => {
    el.scrollIntoView({ block: "center", behavior: "instant" });
    const r = el.getBoundingClientRect();
    const before = getComputedStyle(el, "::before");
    const size = (px: string, own: number) => Math.max(own, parseFloat(px) || 0);
    const [cx, cy] = [r.left + r.width / 2, r.top + r.height / 2];
    const misses: string[] = [];
    for (const dx of [-21, 0, 21])
      for (const dy of [-21, 0, 21]) {
        const hit = document.elementFromPoint(cx + dx, cy + dy);
        if (!hit || !el.contains(hit)) misses.push(`${dx},${dy}: ${hit?.tagName}${hit?.getAttribute("aria-label") ? ` ${hit.getAttribute("aria-label")}` : ""}`);
      }
    return { width: size(before.width, r.width), height: size(before.height, r.height), misses };
  });
}

test("on a phone, small links and buttons take taps over 44x44 px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const header = page.locator("header");
  const targets: Array<[string, Locator]> = [
    ["logo", header.getByRole("link", { name: "RowTech home" })],
    ["Menu", header.locator("summary")],
    ["header CTA", header.getByRole("link", { name: "Apply for the beta" })],
    ["See Force", page.locator("figcaption").getByRole("link", { name: "See Force" })],
    ["Force card", page.getByRole("link", { name: "See Force and its specifications" })],
    ["Vieve card", page.getByRole("link", { name: "See Vieve and its specifications" })],
  ];
  const footerLinks = await page.getByRole("navigation", { name: "Footer" }).getByRole("link").all();
  for (const link of footerLinks) targets.push([`footer ${await link.textContent()}`, link]);
  for (const [name, target] of targets) {
    const a = await tapArea(target);
    expect(a.width, name).toBeGreaterThanOrEqual(44);
    expect(a.height, name).toBeGreaterThanOrEqual(44);
    expect(a.misses, name).toEqual([]);
  }
  // The footer links are still drawn at their text's height, so a focus ring
  // sits around the words, not the whole tap box.
  for (const link of footerLinks) expect((await link.boundingBox())!.height).toBeLessThanOrEqual(24);

  // The stroke chart's numbered markers. A tap anywhere on a drawn marker picks
  // that marker. Around it, a tap within 22px picks it, or, where two sit
  // closer than 44px, one of the two; none are lost to the chart under them.
  const chart = page.locator("#stroke");
  await chart.scrollIntoViewIfNeeded();
  // The server's copy is static; wait for the live one to swap in. The chips
  // under the chart say which measure is picked (the markers are hidden from
  // assistive tech on a phone, A11Y-006).
  const chips = await chart.getByRole("list", { name: "Stroke metrics" }).getByRole("button").all();
  const rhythm = chart.getByRole("button", { name: /Rhythm/ });
  await expect(async () => {
    await rhythm.click();
    await expect(rhythm).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
  }).toPass({ timeout: 10000 });
  const markers = chart.locator('button[aria-hidden="true"]');
  await expect(markers).toHaveCount(7);
  await markers.first().evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  const all = await markers.all();
  const names = await Promise.all(chips.map(async (c) => (await c.textContent())!));
  const boxes = await Promise.all(all.map(async (m) => (await m.boundingBox())!));
  const centres = boxes.map((b) => [b.x + b.width / 2, b.y + b.height / 2]);
  const pressed = async () => names[(await Promise.all(chips.map((c) => c.getAttribute("aria-pressed")))).indexOf("true")];
  for (const [i, marker] of all.entries()) {
    const wrong = await marker.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const others = [...el.parentElement!.querySelectorAll("button")].filter((b) => b !== el).map((b) => b.getBoundingClientRect());
      const out: string[] = [];
      for (let dx = 1; dx < r.width; dx += 2)
        for (let dy = 1; dy < r.height; dy += 2) {
          const [px, py] = [r.left + dx, r.top + dy];
          // Not the rounded corners' outside, nor where another is drawn on top
          // (to within a pixel: two of them touch).
          if ((dx < 6 || dx > r.width - 6) && (dy < 6 || dy > r.height - 6)) continue;
          if (others.some((o) => px >= o.left - 1 && px <= o.right + 1 && py >= o.top - 1 && py <= o.bottom + 1)) continue;
          const hit = document.elementFromPoint(px, py);
          if (!hit || !el.contains(hit)) out.push(`${dx},${dy}: ${hit?.closest("button")?.textContent ?? hit?.tagName}`);
        }
      return out;
    });
    expect(wrong, names[i]).toEqual([]);
    for (const dx of [-21, 0, 21])
      for (const dy of [-21, 0, 21]) {
        const [px, py] = [centres[i][0] + dx, centres[i][1] + dy];
        // The markers whose 44px box this point is in (half a pixel's grace).
        const near = names.filter((_, j) => Math.abs(centres[j][0] - px) <= 22.5 && Math.abs(centres[j][1] - py) <= 22.5);
        // Start from a marker the tap mustn't pick, so a missed tap shows.
        const other = centres[names.findIndex((n) => !near.includes(n))];
        await page.mouse.click(other[0], other[1]);
        await page.mouse.click(px, py);
        const got = await pressed();
        if (near.length === 1) expect(got, `${names[i]} ${dx},${dy}`).toBe(names[i]);
        else expect(near, `${names[i]} ${dx},${dy}`).toContain(got);
      }
  }

  await page.goto("/app/login");
  const logo = await tapArea(page.getByRole("link", { name: "RowTech home" }));
  expect(Math.min(logo.width, logo.height)).toBeGreaterThanOrEqual(44);
  expect(logo.misses).toEqual([]);
  // Google's button, when it's on, is drawn 40px high, to its guidelines, but
  // takes taps over 44px.
  if (googleSignIn) {
    const google = await tapArea(page.getByRole("button", { name: "Continue with Google" }));
    expect(Math.min(google.width, google.height)).toBeGreaterThanOrEqual(44);
    expect(google.misses).toEqual([]);
    expect((await page.getByRole("button", { name: "Continue with Google" }).boundingBox())!.height).toBeCloseTo(40, 0);
  }
  // The product pages' "Show the 3D model", a line of small text under the drawing.
  for (const path of ["/force", "/vieve"]) {
    await page.goto(path);
    const show = await tapArea(page.locator("#parts").getByRole("button", { name: "Show the 3D model" }));
    expect(Math.min(show.width, show.height), path).toBeGreaterThanOrEqual(44);
    expect(show.misses, path).toEqual([]);
  }
});
