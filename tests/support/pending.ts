import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Sends a form with Enter on its submit button while its POST is held, and
 * checks what it's like to wait (A11Y-011): the form is aria-busy, a polite
 * live region outside it says `status`, and the button keeps focus, marked
 * aria-disabled, where a second Enter doesn't send again. Then lets the POST
 * through and returns how many were sent, to check once the result is in.
 */
export async function sendWhileHeld(page: Page, form: Locator, button: Locator, status: string) {
  const path = new URL(page.url()).pathname;
  const live = page.locator("p[aria-live=polite]");
  let posts = 0;
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      posts++;
      await held;
      await route.fallback();
    }
  );

  await expect(live).toHaveText("");
  await expect(live).toHaveClass(/sr-only/);
  await button.focus();
  await page.keyboard.press("Enter");

  await expect(form).toHaveAttribute("aria-busy", "true");
  await expect(live).toHaveText(status);
  const focused = page.locator(":focus");
  await expect(focused).toHaveAttribute("type", "submit");
  await expect(focused).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Enter");
  await expect.poll(() => posts).toBe(1);

  release();
  return { posts: () => posts };
}
