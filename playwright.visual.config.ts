import { defineConfig, devices } from "@playwright/test";

/** Comparación reproducible de dos builds demo; VISUAL_BASE_URL puede apuntar al commit anterior. */
export default defineConfig({
  testDir: "e2e", testMatch: "visual-comparison.spec.ts", workers: 2, timeout: 180_000,
  expect: { timeout: 10_000 },
  use: { baseURL: process.env.VISUAL_BASE_URL ?? "http://localhost:4188", locale: "es-AR", channel: "chromium", screenshot: "only-on-failure" },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "celular", use: { ...devices["Pixel 7"], viewport: { width: 320, height: 740 } } },
  ],
  webServer: process.env.VISUAL_BASE_URL ? undefined : { command: "npm run demo", url: "http://localhost:4188", reuseExistingServer: !process.env.CI },
});
