import { test, expect, type Locator } from "@playwright/test";
import { expectSkipLink } from "./support/skip-link";

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

  // The beta is offered in the nav, the hero, once mid-page and at the close.
  const froms = await page
    .getByRole("link", { name: /apply for the beta/i })
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-cta")));
  expect(froms.sort()).toEqual(["closing", "hero", "nav", "stroke"]);

  // Built and planned are kept apart.
  await expect(page.locator("#beta-scope")).toContainText("In the node’s firmware now");
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
});

test("reduced motion leaves the pages in their finished state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".rt-stroke-cursor")).toBeHidden();
  await page.goto("/vieve");
  await expect(page.locator("#clock")).toContainText("8 of 8");
  // The 3D model still comes up; it goes straight to each view instead of turning.
  await page.locator("#parts").getByRole("button", { name: "Show the 3D model" }).click();
  await expect(page.getByRole("application", { name: "3D model: Parts of Vieve" }).locator("canvas")).toBeVisible({ timeout: 15000 });
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
});
