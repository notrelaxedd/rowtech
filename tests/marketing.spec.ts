import { test, expect } from "@playwright/test";

test("the marketing page renders, with the beta offered in four places", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("seat by seat");
  // The node and its screen are drawn by the server, not fetched as a picture.
  await expect(page.getByRole("img", { name: /Force seat node/i }).first()).toBeVisible();
  await expect(page.locator("#hero-peak")).toHaveCount(1);

  for (const id of ["crew", "how", "stroke", "products", "faq", "beta"]) {
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
});

test("the header links to the product pages only, not to sections of the home page", async ({ page }) => {
  await page.goto("/");
  // A CSS locator, so the links behind the phone menu's closed disclosure are counted too.
  const hrefs = await page.locator("header a[href]").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(hrefs.filter((h) => h?.startsWith("/#"))).toEqual([]);
  expect(hrefs).toEqual(expect.arrayContaining(["/force", "/vieve"]));
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

test("there is no team page for now", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Who we are" })).toHaveCount(0);
  const res = await page.goto("/team");
  expect(res?.status()).toBe(404);
});

test("the diagrams light the part a note describes", async ({ page }) => {
  await page.goto("/force");
  await page.locator("#parts figure").first().scrollIntoViewIfNeeded();
  const note = page.getByRole("list", { name: "Parts of the Force node" }).getByRole("button", { name: /TARE/ });
  await note.click();
  await expect(note).toHaveAttribute("aria-pressed", "true");
});

test("the Vieve page shows it as a 3D model too", async ({ page }) => {
  await page.goto("/vieve");
  const model = page.getByRole("group", { name: "3D model: Parts of Vieve" });
  await model.scrollIntoViewIfNeeded();
  await expect(model.locator("canvas")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#parts")).toContainText("concept design");
});
