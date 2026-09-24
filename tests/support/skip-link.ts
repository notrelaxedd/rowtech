import { expect, type Page } from "@playwright/test";

/**
 * The page's first Tab stop is a "Skip to content" link, hidden until it has
 * focus; Enter on it moves focus to <main>, and the next Tab stays in there
 * (WCAG 2.4.1, A11Y-001). Call it on a freshly loaded page.
 */
export async function expectSkipLink(page: Page) {
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toHaveCount(1);
  await expect(skip).toHaveAttribute("href", "#main");
  const width = async () => (await skip.boundingBox())?.width ?? 0;
  expect(await width()).toBeLessThanOrEqual(1);

  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  expect(await width()).toBeGreaterThan(1);

  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
  expect(await width()).toBeLessThanOrEqual(1);

  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.querySelector("main")!.contains(document.activeElement))).toBe(true);
}
