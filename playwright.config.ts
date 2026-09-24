import { defineConfig, devices } from "@playwright/test";
import { outage } from "./tests/support/local-supabase";

const PORT = 3210;

// Smoke tests run against a production build, the way the site actually ships.
// BETA_DRY_RUN keeps the beta form off the live Supabase table.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testIgnore: /(node|rls|outage|chart)\.spec\.ts/ },
  ],
  webServer: [
    {
      command: `npm run build && npx next start -p ${PORT}`,
      port: PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      // SITE_URL: sign-in links come back to the site under test. TZ: the
      // server's zone is UTC, as on Vercel, whatever the machine's is.
      env: { BETA_DRY_RUN: "1", SITE_URL: `http://localhost:${PORT}`, TZ: "UTC" },
    },
    // Started in order, so this one reuses the build above.
    ...(outage
      ? [
          {
            command: "node tests/support/supabase-outage.mjs",
            port: Number(new URL(outage.supabase).port),
            reuseExistingServer: !process.env.CI,
            env: { UPSTREAM_SUPABASE_URL: process.env.SUPABASE_URL!, PORT: new URL(outage.supabase).port },
          },
          {
            command: `npx next start -p ${new URL(outage.app).port}`,
            port: Number(new URL(outage.app).port),
            reuseExistingServer: !process.env.CI,
            env: { BETA_DRY_RUN: "1", SITE_URL: outage.app, TZ: "UTC", SUPABASE_URL: outage.supabase },
          },
        ]
      : []),
  ],
});
