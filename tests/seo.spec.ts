import { test, expect, type Page } from "@playwright/test";

const meta = (page: Page, key: string) => page.locator(`meta[property="${key}"], meta[name="${key}"]`);
const pathOf = (href: string | null) => (href ? new URL(href).pathname : null);

// Each public page is its own page to a search engine and in a shared link.
const PAGES = [
  { path: "/", title: "RowTech: the force curve from every seat in the boat" },
  { path: "/beta", title: "Apply for the beta · RowTech" },
  { path: "/force", title: "Force, the seat node · RowTech" },
  { path: "/vieve", title: "Vieve, the cox box · RowTech" },
  { path: "/privacy", title: "Privacy · RowTech" },
  { path: "/terms", title: "Terms · RowTech" },
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

test("the dashboard's tab titles use the site's separator", async ({ page }) => {
  await page.goto("/app/login");
  await expect(page).toHaveTitle("Sign in · RowTech");
});

test("robots.txt keeps crawlers out of the dashboard and points to the sitemap", async ({ request, baseURL }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toMatch(/^User-Agent: \*$/m);
  expect(body).toMatch(/^Allow: \/$/m);
  expect(body).toMatch(/^Disallow: \/app\/$/m);
  expect(body).toMatch(/^Disallow: \/auth\/$/m);
  expect(body).toMatch(new RegExp(`^Sitemap: ${baseURL}/sitemap\\.xml$`, "m"));
});

test("the sitemap lists the public pages and nothing else", async ({ request, baseURL }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const locs = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  expect(locs.sort()).toEqual(["/", "/beta", "/force", "/privacy", "/terms", "/vieve"]);
  expect(await res.text()).toContain(`<loc>${baseURL}/force</loc>`);
});

test("structured data: the home page's Organization, and no Product without an offer", async ({ page }) => {
  const blocks = async () =>
    (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t));
  await page.goto("/");
  const home = await blocks();
  expect(home).toHaveLength(1);
  expect(home[0]["@graph"].map((n: { "@type": string }) => n["@type"])).toEqual(["Organization"]);
  for (const path of ["/force", "/vieve", "/beta"]) {
    await page.goto(path);
    expect(JSON.stringify(await blocks())).not.toContain('"Product"');
  }
});

test("the icons are there for browsers, bookmarks and home screens", async ({ page, request }) => {
  await page.goto("/");
  const hrefs: Record<string, string | null> = {};
  for (const sel of ['link[rel="icon"][href^="/favicon.ico"]', 'link[rel="icon"][type="image/svg+xml"]', 'link[rel="apple-touch-icon"]']) {
    await expect(page.locator(sel)).toHaveCount(1);
    hrefs[sel] = await page.locator(sel).getAttribute("href");
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("sizes", "180x180");
  for (const href of Object.values(hrefs)) {
    const res = await request.get(href!);
    expect(res.status(), href!).toBe(200);
  }
  // Asked for directly, without a link tag.
  const ico = await request.get("/favicon.ico");
  expect(ico.status()).toBe(200);
  expect(ico.headers()["content-type"]).toContain("image/x-icon");
});

test("the browser's bar takes the colour of the page behind it", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0a1c23");
  await page.goto("/app/login");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#07090b");
});
