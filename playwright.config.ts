import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de punta a punta sobre el sitio estático (`out/`), igual que en producción: cada test
 * arranca con un navegador limpio (casa nueva, sin datos) y entra como Administrador.
 *
 * - Local: `npm run build && npm run e2e` (usa el Chrome instalado).
 * - CI: instala Chromium (`npx playwright install --with-deps chromium`).
 */
const PORT = 4173;

export default defineConfig({
  testDir: "e2e",
  testIgnore: ["local-build.spec.ts", "demo.spec.ts"],
  fullyParallel: true,
  // Pocos a la vez: cada test levanta un navegador entero y la app anima bastante.
  workers: process.env.CI ? 2 : 3,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "es-AR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome" } },
    { name: "celular", use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "chrome" } },
  ],
  webServer: {
    command: `npm start`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
