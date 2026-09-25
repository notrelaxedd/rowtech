import { test, expect, type Page } from "@playwright/test";

const meta = (page: Page, key: string) => page.locator(`meta[property="${key}"], meta[name="${key}"]`);
const pathOf = (href: string | null) => (href ? new URL(href).pathname : null);

// Each public page is its own page to a search engine and in a shared link.
const PAGES = [
  { path: "/", title: "RowTech: the force curve from every seat in the boat" },
  { path: "/beta", title: "Apply for the beta | RowTech" },
  { path: "/force", title: "Force, the seat node | RowTech" },
  { path: "/vieve", title: "Vieve, the RowTech cox box | RowTech" },
];

for (const { path, title } of PAGES) {
  test(`${path} names itself as the canonical URL and in its share tags`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    const description = await meta(page, "description").getAttribute("content");

    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    expect(pathOf(await page.locator('link[rel="canonical"]').getAttribute("href"))).toBe(path);
    expect(pathOf(await meta(page, "og:url").getAttribute("content"))).toBe(path);

    await expect(meta(page, "og:title")).toHaveAttribute("content", title);
    await expect(meta(page, "twitter:title")).toHaveAttribute("content", title);
    if (path !== "/") {
      await expect(meta(page, "og:description")).toHaveAttribute("content", description!);
      await expect(meta(page, "twitter:description")).toHaveAttribute("content", description!);
    }
    // What every page shares.
    await expect(meta(page, "og:site_name")).toHaveAttribute("content", "RowTech");
    await expect(meta(page, "og:type")).toHaveAttribute("content", "website");
    await expect(meta(page, "og:image").first()).toHaveAttribute("content", /\/og\.png$/);
    await expect(meta(page, "twitter:card")).toHaveAttribute("content", "summary_large_image");
  });
}

test("pages that set no canonical don't inherit the home page's", async ({ page }) => {
  for (const path of ["/app/login", "/no-such-page"]) {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(meta(page, "og:url")).toHaveCount(0);
  }
});
