import { test, expect } from "@playwright/test";
import { expectSkipLink } from "./support/skip-link";

test("the marketing page renders, with the beta offered in four places", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("seat by seat");
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
  await expect(page.getByRole("heading", { level: 1 })).toContainText("seat by seat");
});

test("an address the site doesn't have gets the site's own 404", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  // One title, and it says what happened.
  await expect(page.locator("title")).toHaveCount(1);
  await expect(page).toHaveTitle("Page not found | RowTech");
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
  const rise = chart.getByRole("button", { name: /^Rise rate:/ });
  // The server's copy is static; the live one swaps in as it comes into view.
  await expect(async () => {
    await rise.click();
    await expect(rise).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
  }).toPass({ timeout: 10000 });
  await expect(chart.getByRole("button", { name: /^Catch:/ })).toHaveAttribute("aria-pressed", "false");
  await expect(chart.locator('[aria-live="polite"]')).toContainText("How quickly the blade loads");
  // Passing the mouse over another measure doesn't pick it (LEAD-010).
  await chart.getByRole("button", { name: /^Catch:/ }).hover();
  await page.waitForTimeout(300);
  await expect(rise).toHaveAttribute("aria-pressed", "true");
  await expect(chart.locator('[aria-live="polite"]')).toContainText("How quickly the blade loads");
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
    await header.getByRole("link", { name: "FAQ", exact: true }).filter({ visible: true }).click();
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
