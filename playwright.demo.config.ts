import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "e2e", testMatch: ["demo.spec.ts", "visual-tour.spec.ts"], timeout: 60_000,
  expect: { timeout: 10_000 }, workers: 2, retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://localhost:4188", locale: "es-AR", channel: "chromium", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [{ name: "escritorio", use: devices["Desktop Chrome"] }, { name: "celular", use: devices["Pixel 7"] }],
  webServer: { command: "npm run demo", url: "http://localhost:4188", reuseExistingServer: !process.env.CI },
});
