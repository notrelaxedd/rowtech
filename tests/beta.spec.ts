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
