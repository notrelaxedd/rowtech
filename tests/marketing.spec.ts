import { test, expect } from "@playwright/test";

test("the marketing page renders, and every section offers the beta", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Every seat.");
  // The node and its screen are drawn by the server, not fetched as a picture.
  await expect(page.getByRole("img", { name: /Force seat node/i }).first()).toBeVisible();
  await expect(page.locator("#hero-peak")).toHaveCount(1);

  for (const id of ["crew", "how", "stroke", "screens", "vieve", "boathouse", "beta-scope", "faq", "beta"]) {
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  }

  // Vieve is named, and named properly on first mention.
  await expect(page.locator("#crew")).toContainText("Vieve, the RowTech cox box");
  await expect(page.locator("#faq")).toContainText("Vieve");

  // Every section ends on a way into the beta.
  const applyLinks = page.getByRole("link", { name: /apply for the beta/i });
  expect(await applyLinks.count()).toBeGreaterThanOrEqual(8);

  // Nothing is hidden when the reveals never fire.
  await expect(page.locator("#beta-scope")).toContainText("Working today");
});

test("the sticky CTA appears after the hero and stands aside at the closing CTA", async ({ page }) => {
  await page.goto("/");
  const sticky = page.getByRole("link", { name: /apply for the beta/i }).last();

  await page.locator("#how").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  // The phone gets the bottom button, the desktop the slim bar under the header.
  const bar = page.locator('[data-cta="sticky"]:visible, [data-cta="topbar"]:visible').first();
  await expect(bar).toBeVisible();

  await page.locator('[data-section="closing"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await expect(sticky).toBeVisible(); // the closing CTA itself
});

test("reduced motion leaves the page in its finished state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator("#crew").scrollIntoViewIfNeeded();
  await expect(page.locator('[data-reveal="armed"]')).toHaveCount(0);
  await expect(page.locator("#vieve")).toContainText("8/8");
});

test("the node's keys light their key on the device", async ({ page }) => {
  await page.goto("/");
  await page.locator("#screens").scrollIntoViewIfNeeded();

  const view = page.getByRole("button", { name: /^VIEW/ });
  await expect(view).toBeVisible();
  // The device is drawn in the markup, with the screen the keys drive.
  await expect(page.locator("#screens").getByRole("img", { name: /Force seat node/i })).toBeVisible({ timeout: 15000 });

  await view.hover();
  await expect(page.locator("#screens")).toContainText("Cycles what the screen shows");
});

test("Vieve is shown as well as described", async ({ page }) => {
  await page.goto("/");
  // The drawing is an island, so scroll to the figure itself, not the heading:
  // on a phone the section is taller than the trigger margin.
  await page.locator("#vieve figure").first().scrollIntoViewIfNeeded();
  await expect(page.locator("#vieve").getByRole("img", { name: /Vieve V1/i })).toBeVisible({ timeout: 15000 });
  await expect(page.locator("#vieve")).toContainText("Vieve specs");
});
