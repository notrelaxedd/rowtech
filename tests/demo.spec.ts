import { test, expect } from "@playwright/test";

test("demo mode loads the sample session and scrubs", async ({ page }) => {
  await page.goto("/demo");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("A session");
  await expect(page.getByText("SAMPLE DATA")).toBeVisible();

  // The viewer only appears once the files have been fetched and parsed.
  const timeline = page.getByRole("slider", { name: "Stroke" });
  await expect(timeline).toBeVisible({ timeout: 15000 });
  await expect(timeline).toHaveAttribute("aria-valuemax", "147");

  // Summary comes from the files, not from the page.
  await expect(page.getByText("Strokes", { exact: true })).toBeVisible();
  await expect(page.locator("dd").first()).toHaveText("147");

  // Keyboard scrubbing moves the selected stroke.
  await timeline.focus();
  await page.keyboard.press("End");
  await expect(timeline).toHaveAttribute("aria-valuenow", "147");
  await page.keyboard.press("Home");
  await expect(timeline).toHaveAttribute("aria-valuenow", "1");
  await page.keyboard.press("ArrowRight");
  await expect(timeline).toHaveAttribute("aria-valuenow", "2");

  // The force curve is drawn for the selected stroke.
  await expect(page.getByRole("img", { name: /Force curve for stroke 2/ })).toBeVisible();

  // And it ends on the beta.
  await expect(page.getByRole("link", { name: /apply for the beta/i }).last()).toBeVisible();
});

test("a second seat can be laid over the first", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("slider", { name: "Stroke" })).toBeVisible({ timeout: 15000 });

  await page.getByLabel("Overlay seat").selectOption("seat-5");
  await expect(page.getByText(/^5, stroke 1 ·/)).toBeVisible({ timeout: 10000 });
});
