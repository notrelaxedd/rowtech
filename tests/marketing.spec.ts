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
});

test("the Force page shows the node as a 3D model with its notes around it", async ({ page }) => {
  await page.goto("/force");
  const model = page.getByRole("group", { name: "3D model: Parts of the Force node" });
  await model.scrollIntoViewIfNeeded();
  await expect(model.locator("canvas")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#parts")).toContainText("Steps through the rower’s screens");
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
  await expect(main.getByRole("link", { name: /apply for the beta/i })).toHaveAttribute("href", "/beta?from=not-found");
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
});

test("the Vieve page shows it as a 3D model too", async ({ page }) => {
  await page.goto("/vieve");
  const model = page.getByRole("group", { name: "3D model: Parts of Vieve" });
  await model.scrollIntoViewIfNeeded();
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
