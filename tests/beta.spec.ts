import { test, expect } from "@playwright/test";

// The server runs with BETA_DRY_RUN=1: the whole path runs, nothing is written.
test("the beta form submits and says what happens next", async ({ page }) => {
  await page.goto("/beta?from=hero");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Apply for the beta");

  await page.getByLabel("Name").fill("Sam Rower");
  await page.getByLabel("Email").fill("sam.rower@example.com");
  await page.getByLabel("Club, school or program").fill("Riverside RC");

  // The optional details open by themselves once the required three are in.
  await expect(page.locator("form details")).toHaveAttribute("open", "", { timeout: 3000 });

  await page.getByText("8+", { exact: true }).click();
  await page.getByRole("button", { name: /apply for the beta/i }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("We have your application");
  await expect(page.getByText("We read your application.")).toBeVisible();
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
