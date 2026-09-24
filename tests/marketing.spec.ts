import { test, expect } from "@playwright/test";

test("the marketing page renders, with the beta offered in four places", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("every seat");
  // The node and its screen are drawn by the server, not fetched as a picture.
  await expect(page.getByRole("img", { name: /Force seat node/i }).first()).toBeVisible();
  await expect(page.locator("#hero-peak")).toHaveCount(1);

  for (const id of ["crew", "how", "stroke", "screens", "vieve", "boathouse", "beta-scope", "faq", "team", "beta"]) {
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

test("reduced motion leaves the page in its finished state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".rt-stroke-cursor")).toBeHidden();
  await expect(page.locator("#vieve")).toContainText("8 of 8");
});

test("the node's keys light their key on the device", async ({ page }) => {
  await page.goto("/");
  // Scroll to the drawing itself: on a phone the section is taller than the
  // island's trigger margin.
  await page.locator("#screens figure").first().scrollIntoViewIfNeeded();

  const view = page.getByRole("button", { name: /^VIEW/ });
  await expect(view).toBeVisible();
  // The device is drawn in the markup, with the screen the keys drive.
  await expect(page.locator("#screens").getByRole("img", { name: /Force seat node/i })).toBeVisible({ timeout: 15000 });

  await view.hover();
  await expect(page.locator("#screens")).toContainText("Steps through the rower's screens");
});

test("Vieve is shown as well as described", async ({ page }) => {
  await page.goto("/");
  // The drawing is an island, so scroll to the figure itself, not the heading:
  // on a phone the section is taller than the trigger margin.
  await page.locator("#vieve figure").first().scrollIntoViewIfNeeded();
  await expect(page.locator("#vieve").getByRole("img", { name: /Vieve V1/i })).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#vieve")).toContainText("concept design");
});
