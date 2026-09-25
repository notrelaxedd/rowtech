import { test, expect, type Page } from "@playwright/test";
import { localSupabaseMissing, makeUser, signInBrowser } from "./support/local-supabase";
import { contactEmail, contactIsEmail } from "../lib/owner";

const LEGAL = [
  { path: "/privacy", title: "Privacy · RowTech", h1: "Privacy." },
  { path: "/terms", title: "Terms · RowTech", h1: "Terms." },
  { path: "/accessibility", title: "Accessibility · RowTech", h1: "Accessibility." },
  { path: "/licenses", title: "Open-source licenses · RowTech", h1: "Open-source licenses." },
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

// Nothing specific is promised to beta crews until the owners say what is
// (LEG-009), and the beta's terms are a link away.
test("the home page's beta section links to the terms and promises no discount", async ({ page }) => {
  await page.goto("/");
  const beta = page.locator("#beta");
  await expect(beta.getByRole("link", { name: "Terms", exact: true })).toHaveAttribute("href", "/terms");
  await expect(page.locator("main")).not.toContainText(/discount/i);
});

async function expectPolicyLinks(scope: ReturnType<Page["locator"]>) {
  await expect(scope.getByRole("link", { name: "Privacy", exact: true })).toHaveAttribute("href", "/privacy");
  await expect(scope.getByRole("link", { name: "Terms", exact: true })).toHaveAttribute("href", "/terms");
}

test("the footer links to Privacy and Terms", async ({ page }) => {
  await page.goto("/");
  await expectPolicyLinks(page.getByRole("navigation", { name: "Footer" }));
});

test("the footer links to the accessibility statement and the open-source licenses", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("navigation", { name: "Footer" });
  await expect(footer.getByRole("link", { name: "Accessibility", exact: true })).toHaveAttribute("href", "/accessibility");
  await expect(footer.getByRole("link", { name: "Open-source licenses", exact: true })).toHaveAttribute("href", "/licenses");
});

test("the accessibility statement says where to report a problem", async ({ page }) => {
  await page.goto("/accessibility");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 2, name: "Reporting a problem" })).toBeVisible();
  await expect(main).toContainText(`doesn’t work for you, write to ${contactEmail}.`);
  if (contactIsEmail) await expect(main.getByRole("link", { name: contactEmail })).toHaveAttribute("href", `mailto:${contactEmail}`);
});

// LEG-014: the bundles drop the packages' notices, so the site carries them.
test("/licenses lists the shipped packages with their licenses, and links to their full texts", async ({ page, request }) => {
  await page.goto("/licenses");
  const main = page.getByRole("main");
  for (const name of ["next", "react", "react-dom", "three"]) {
    const row = main.locator("dl > div").filter({ has: page.locator("dt", { hasText: new RegExp(`^${name} \\d`) }) });
    await expect(row.first().locator("dd"), name).toHaveText("MIT");
  }
  // devDependencies aren't shipped.
  await expect(main.locator("dt", { hasText: /^(typescript|eslint|@playwright\/test) / })).toHaveCount(0);

  const link = main.getByRole("link", { name: "one plain-text file" });
  await expect(link).toHaveAttribute("href", "/licenses.txt");
  const txt = await request.get("/licenses.txt");
  expect(txt.status()).toBe(200);
  expect(txt.headers()["content-type"]).toContain("text/plain");
  const body = await txt.text();
  expect(body).toMatch(/^three 0\.\d+\.\d+\nLicense: MIT$/m);
  expect(body).toContain("Copyright © 2010-2026 three.js authors");
  expect(body).toMatch(/^next \d+\.\d+\.\d+\nLicense: MIT$/m);
});

/** Says where to write: lib/owner.ts's contact, a mailto link once it's an address. */
async function expectContact(scope: ReturnType<Page["locator"]>) {
  await expect(scope).toContainText(`Write to ${contactEmail}`);
  if (contactIsEmail) await expect(scope.getByRole("link", { name: contactEmail })).toHaveAttribute("href", `mailto:${contactEmail}`);
}

test("every site page's footer says where to write", async ({ page }) => {
  for (const path of ["/", "/force", "/vieve", "/beta", "/privacy", "/terms", "/accessibility", "/licenses"]) {
    await page.goto(path);
    await expectContact(page.locator("footer"));
  }
});

test("the beta confirmation says where to write", async ({ page }) => {
  await page.goto("/beta");
  await page.getByLabel("Name").fill("Sam Rower");
  await page.getByLabel("Email").fill("sam.rower@example.com");
  await page.getByLabel("Club, school or program").fill("Riverside RC");
  await page.getByRole("button", { name: /apply for the beta/i }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("We have your application");
  await expectContact(page.getByRole("main"));
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

  test("the request-access page links to Privacy and Terms, and says where to write", async ({ page, context, baseURL }) => {
    const user = await makeUser({ allowed: false });
    await signInBrowser(context, user, baseURL!);
    await page.goto("/app");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The dashboard is for beta crews.");
    await expectPolicyLinks(page.getByRole("main"));
    // No email is ever sent to applicants, so there's none to reply to (CNT-003).
    await expect(page.getByRole("main")).not.toContainText("Reply to our email");
    await expectContact(page.getByRole("main"));
  });
});

test.describe("signed in to the dashboard", () => {
  test.skip(!!localSupabaseMissing, localSupabaseMissing ?? "");

  test("every dashboard page links to Privacy and Terms", async ({ page, context, baseURL }) => {
    const user = await makeUser();
    await signInBrowser(context, user, baseURL!);
    for (const path of ["/app/force", "/app/cox"]) {
      await page.goto(path);
      await expect(page.getByRole("navigation", { name: "Dashboard" })).toBeVisible();
      await expectPolicyLinks(page.getByRole("navigation", { name: "Footer" }));
    }
  });
});

// Owner placeholders are for people reading the page, never for crawlers or
// share previews. Built in two parts so this file isn't itself a hit when the
// owners search the code for placeholders still to fill in.
const PLACEHOLDER = "[" + "OWNER:";
test("no page's head, structured data or labels carry an owner placeholder", async ({ page, request }) => {
  for (const path of ["/", "/force", "/vieve", "/beta", "/privacy", "/terms", "/accessibility", "/licenses", "/app/login", "/no-such-page"]) {
    const html = await (await request.get(path)).text();
    expect(html.slice(0, html.indexOf("</head>")), path).not.toContain(PLACEHOLDER);
    await page.goto(path);
    const read = await page.evaluate(() => [
      document.head.innerHTML,
      ...[...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? ""),
      ...[...document.querySelectorAll("[aria-label], [alt], [title]")].flatMap((el) =>
        ["aria-label", "alt", "title"].map((a) => el.getAttribute(a) ?? ""),
      ),
    ]);
    for (const text of read) expect(text, path).not.toContain(PLACEHOLDER);
  }
});
