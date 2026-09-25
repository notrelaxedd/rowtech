import { test, expect, type Page } from "@playwright/test";
import { localSupabaseMissing, makeUser, signInBrowser } from "./support/local-supabase";

const LEGAL = [
  { path: "/privacy", title: "Privacy · RowTech", h1: "Privacy." },
  { path: "/terms", title: "Terms · RowTech", h1: "Terms." },
];

for (const { path, title, h1 } of LEGAL) {
  test(`${path} is a page of the site, with one heading, its title and its canonical URL`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(title);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
    expect(new URL((await page.locator('link[rel="canonical"]').getAttribute("href"))!).pathname).toBe(path);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /\S/);
    // The site's own frame, so the way back is there.
    await expect(page.getByRole("navigation", { name: "Footer" })).toBeVisible();
  });
}

test("the privacy and terms pages link to each other", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("main").getByRole("link", { name: "Terms", exact: true })).toHaveAttribute("href", "/terms");
  await page.goto("/terms");
  await expect(page.getByRole("main").getByRole("link", { name: "Privacy", exact: true })).toHaveAttribute("href", "/privacy");
});

async function expectPolicyLinks(scope: ReturnType<Page["locator"]>) {
  await expect(scope.getByRole("link", { name: "Privacy", exact: true })).toHaveAttribute("href", "/privacy");
  await expect(scope.getByRole("link", { name: "Terms", exact: true })).toHaveAttribute("href", "/terms");
}

test("the footer links to Privacy and Terms", async ({ page }) => {
  await page.goto("/");
  await expectPolicyLinks(page.getByRole("navigation", { name: "Footer" }));
});

test("under the beta form's button: what the details are for, and Privacy and Terms", async ({ page }) => {
  await page.goto("/beta");
  const form = page.locator("form");
  await expect(form.getByText("We use this to talk to you about the beta, and we note which link brought you here.")).toBeVisible();
  await expectPolicyLinks(form);
  // Links inside a sentence are underlined, not only coloured (A11Y-002).
  await expect(form.getByRole("link", { name: "Privacy", exact: true })).toHaveCSS("text-decoration-line", "underline");
});

test("the sign-in page links to Privacy and Terms under its forms", async ({ page }) => {
  await page.goto("/app/login");
  await expectPolicyLinks(page.getByRole("main"));
});

test.describe("signed in, but not on the beta list", () => {
  test.skip(!!localSupabaseMissing, localSupabaseMissing ?? "");

  test("the request-access page links to Privacy and Terms", async ({ page, context, baseURL }) => {
    const user = await makeUser({ allowed: false });
    await signInBrowser(context, user, baseURL!);
    await page.goto("/app");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The dashboard is for beta crews.");
    await expectPolicyLinks(page.getByRole("main"));
  });
});

// Owner placeholders are for people reading the page, never for crawlers or
// share previews.
test("no page's head, structured data or labels carry an owner placeholder", async ({ page, request }) => {
  for (const path of ["/", "/force", "/vieve", "/beta", "/privacy", "/terms", "/app/login", "/no-such-page"]) {
    const html = await (await request.get(path)).text();
    expect(html.slice(0, html.indexOf("</head>")), path).not.toContain("[OWNER:");
    await page.goto(path);
    const read = await page.evaluate(() => [
      document.head.innerHTML,
      ...[...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? ""),
      ...[...document.querySelectorAll("[aria-label], [alt], [title]")].flatMap((el) =>
        ["aria-label", "alt", "title"].map((a) => el.getAttribute(a) ?? ""),
      ),
    ]);
    for (const text of read) expect(text, path).not.toContain("[OWNER:");
  }
});
