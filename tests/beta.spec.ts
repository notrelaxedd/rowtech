import { test, expect } from "@playwright/test";

// The server runs with BETA_DRY_RUN=1: the whole path runs, nothing is written.
test("the beta form submits and says what happens next", async ({ page }) => {
  // An older link with ?from= still says where it came from.
  await page.goto("/beta?from=hero");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Apply for the beta");

  await page.getByLabel("Name").fill("Sam Rower");
  await page.getByLabel("Email").fill("sam.rower@example.com");
  await page.getByLabel("Club, school or program").fill("Riverside RC");

  // The optional details open by themselves once the required three are in.
  await expect(page.locator("form details")).toHaveAttribute("open", "", { timeout: 3000 });

  await page.getByText("8+", { exact: true }).click();
  const sent = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/beta");
  await page.getByRole("button", { name: /apply for the beta/i }).click();
  expect((await sent).postData()).toMatch(/from"\s+hero\s/);

  await expect(page.getByRole("heading", { level: 1 })).toContainText("We have your application");
  await expect(page.getByText("We read your application.")).toBeVisible();
});

test("every beta link goes to the one /beta, and the form knows which was used", async ({ page, request }) => {
  // One static page, cached rather than rendered per visit.
  const res = await request.get("/beta");
  expect(res.headers()["x-nextjs-prerender"]).toMatch(/^1\b/);
  expect(res.headers()["cache-control"] ?? "").not.toMatch(/no-store|private/);

  await page.goto("/");
  const hrefs = await page.locator("a[data-cta]").filter({ hasText: /apply for the beta/i }).evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(hrefs.length).toBeGreaterThan(0);
  expect(new Set(hrefs)).toEqual(new Set(["/beta"]));

  await page.locator("a[data-cta=hero]").click();
  await expect(page).toHaveURL(/\/beta$/);
  await expect(page.locator('input[name="from"]')).toHaveValue("hero");

  await page.getByLabel("Name").fill("Sam Rower");
  await page.getByLabel("Email").fill("sam.rower@example.com");
  await page.getByLabel("Club, school or program").fill("Riverside RC");
  const sent = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/beta");
  await page.getByRole("button", { name: /apply for the beta/i }).click();
  expect((await sent).postData()).toMatch(/from"\s+hero\s/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("We have your application");
});

test("straight to /beta, the form says it came direct", async ({ page }) => {
  await page.goto("/beta");
  await expect(page.locator('input[name="from"]')).toHaveValue("direct");
});

test("the form says what is wrong rather than failing silently", async ({ page }) => {
  await page.goto("/beta");
  await page.getByLabel("Name").fill("Sam");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Club, school or program").fill("Riverside RC");
  await page.getByRole("button", { name: /apply for the beta/i }).click();

  await expect(page.getByText(/doesn't look like an email address/i)).toBeVisible();
  // What they typed is still there.
  await expect(page.getByLabel("Name")).toHaveValue("Sam");
});

test("a rejected application keeps the same form, with every answer in it", async ({ page }) => {
  await page.goto("/beta");
  await page.getByLabel("Name").fill("Sam Rower");
  await page.getByLabel("Email").fill("sam.rower@example.com");
  await page.getByLabel("Club, school or program").fill("Riverside RC");
  await page.getByText("Coach", { exact: true }).click();
  await page.getByText("8+", { exact: true }).click();
  await page.getByLabel("Where do you row?").fill("Henley");
  await page.getByLabel("Email").fill("not-an-email");
  const form = await page.locator("form").elementHandle();
  await page.getByRole("button", { name: /apply for the beta/i }).click();

  await expect(page.getByText(/doesn't look like an email address/i)).toBeVisible();
  expect(await form!.evaluate((el) => el.isConnected)).toBe(true);
  await expect(page.getByLabel("Name")).toHaveValue("Sam Rower");
  await expect(page.getByLabel("Email")).toHaveValue("not-an-email");
  await expect(page.getByLabel("Club, school or program")).toHaveValue("Riverside RC");
  await expect(page.getByRole("radio", { name: "Coach" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "8+" })).toBeChecked();
  await expect(page.getByLabel("Where do you row?")).toHaveValue("Henley");

  // Fixed and sent again, it goes through with what was kept.
  await page.getByLabel("Email").fill("sam.rower@example.com");
  await page.getByRole("button", { name: /apply for the beta/i }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("We have your application");
});

test("an error in an optional field opens the details, even after they were closed", async ({ page }) => {
  await page.goto("/beta");
  await page.getByLabel("Name").fill("Sam Rower");
  await page.getByLabel("Email").fill("sam.rower@example.com");
  await page.getByLabel("Club, school or program").fill("Riverside RC");
  await page.getByText("Coach", { exact: true }).click();
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: /apply for the beta/i }).click();
  await expect(page.getByText(/doesn't look like an email address/i)).toBeVisible();

  const details = page.locator("form details");
  await details.locator("summary").click();
  await expect(details).not.toHaveAttribute("open");

  // Over the limit, as a long message with line breaks can be once they are
  // sent as CRLF. Set directly, since maxLength stops typing past it.
  await page.getByLabel("What do you want to see inside your boat?").evaluate((el) => {
    (el as HTMLTextAreaElement).value = "x".repeat(2001);
  });
  await page.getByLabel("Email").fill("sam.rower@example.com");
  await page.getByRole("button", { name: /apply for the beta/i }).click();

  await expect(page.getByText("Keep it under 2000 characters.")).toBeVisible();
  await expect(details).toHaveAttribute("open", "");
});

test("a ?ref= link is sent with the application as its source", async ({ page }) => {
  await page.goto("/?ref=newsletter");
  // Remembered for the tab, then read back at submit time.
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("rt_attr"))).toContain("newsletter");

  await page.goto("/beta");
  await page.getByLabel("Name").fill("Sam Rower");
  await page.getByLabel("Email").fill("sam.rower@example.com");
  await page.getByLabel("Club, school or program").fill("Riverside RC");
  const sent = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/beta");
  await page.getByRole("button", { name: /apply for the beta/i }).click();

  expect((await sent).postData()).toMatch(/utm_source"\s+newsletter/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("We have your application");
});

test("a required field says what's wrong as soon as it's left", async ({ page }) => {
  await page.goto("/beta");
  const email = page.getByLabel("Email");

  // Tabbing past an empty field says nothing yet.
  await page.getByLabel("Name").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Name")).not.toHaveAttribute("aria-invalid");

  await email.fill("not-an-email");
  await email.blur();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAttribute("aria-describedby", "email-error");
  await expect(page.locator("#email-error")).toHaveText("That doesn't look like an email address. Check for a typo.");

  // Put right, it clears while typing.
  await email.fill("sam.rower@example.com");
  await expect(email).not.toHaveAttribute("aria-invalid");
  await expect(page.locator("#email-error")).toHaveCount(0);

  // Typed and then emptied, a field asks for itself.
  const org = page.getByLabel("Club, school or program");
  await org.fill("Riverside RC");
  await org.fill("");
  await org.blur();
  await expect(page.locator("#organization-error")).toHaveText("Which club, school or program do you row with?");
  // Only the field says so; the form-wide alert is for a sent form.
  await expect(page.locator("form").getByRole("alert")).toHaveCount(0);
});

test("a failed send takes focus to the first field to fix", async ({ page }) => {
  await page.goto("/beta");
  await page.getByLabel("Name").fill("Sam Rower");
  // The email is left empty.
  await page.getByLabel("Club, school or program").fill("Riverside RC");
  await page.getByRole("button", { name: /apply for the beta/i }).focus();
  await page.keyboard.press("Enter");

  await expect(page.locator("#email-error")).toHaveText("We need an email address to reply to.");
  await expect(page.getByLabel("Email")).toBeFocused();

  // An error inside the details: they open, and focus goes in there.
  await page.getByLabel("Email").fill("sam.rower@example.com");
  await page.getByLabel("What do you want to see inside your boat?").evaluate((el) => {
    (el as HTMLTextAreaElement).value = "x".repeat(2001);
  });
  await page.getByRole("button", { name: /apply for the beta/i }).click();
  await expect(page.getByLabel("What do you want to see inside your boat?")).toBeFocused();

  // No one field to point at (a choice that isn't one of the options): the message.
  await page.getByLabel("What do you want to see inside your boat?").fill("");
  await page.getByRole("radio", { name: "Coach" }).evaluate((el) => {
    (el as HTMLInputElement).value = "captain";
    (el as HTMLInputElement).checked = true;
  });
  await page.getByRole("button", { name: /apply for the beta/i }).click();
  await expect(page.getByText("Pick one of the options.")).toBeVisible();
  await expect(page.locator("form").getByRole("alert")).toBeFocused();
});

test("the bot trap is nothing a browser would fill in, and a bot that fills it is told it's in", async ({ page }) => {
  await page.goto("/beta");
  const trap = page.locator("form input[tabindex='-1'][type=text]");
  await expect(trap).toHaveCount(1);
  await expect(trap).toHaveAttribute("name", "leave_blank");
  await expect(trap).toHaveAttribute("autocomplete", "off");
  await expect(trap).toHaveAttribute("data-1p-ignore");
  await expect(page.locator("form [aria-hidden] label")).toHaveText("Leave this blank");

  await page.getByLabel("Name").fill("Sam Rower");
  await page.getByLabel("Email").fill("sam.rower@example.com");
  await page.getByLabel("Club, school or program").fill("Riverside RC");
  await trap.evaluate((el) => ((el as HTMLInputElement).value = "https://spam.example"));
  await page.getByRole("button", { name: /apply for the beta/i }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("We have your application");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the form still posts, and says what's wrong or that it's in", async ({ page }) => {
    await page.goto("/beta");
    await expect(page.locator("form").first()).not.toHaveAttribute("action", /^javascript:/);

    await page.getByLabel("Name").fill("Sam Rower");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Club, school or program").fill("Riverside RC");
    await page.getByRole("button", { name: /apply for the beta/i }).click();
    await expect(page.locator("#email-error")).toHaveText("That doesn't look like an email address. Check for a typo.");
    await expect(page.getByLabel("Name")).toHaveValue("Sam Rower");

    await page.getByLabel("Email").fill("sam.rower@example.com");
    await page.getByRole("button", { name: /apply for the beta/i }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("We have your application");
  });
});
