import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "operator/test", timeout: 30000, fullyParallel: true,
  use: { ignoreHTTPSErrors: true, locale: "es-AR", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "chrome" } },
  ],
});
