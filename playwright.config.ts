import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de punta a punta sobre el sitio estático (`out/`), igual que en producción: cada test
 * arranca con un navegador limpio (casa nueva, sin datos) y entra como Administrador.
 *
 * - Local: `npm run build && npm run e2e` (usa el Chrome instalado).
 * - CI: instala Chromium (`npx playwright install --with-deps chromium`).
 */
const PORT = 4173;

/**
 * En los PR, el celular corre solo las pruebas cuyo recorrido cambia en pantalla chica (menú del
 * perfil, selector de vistas, tarjetas). El resto ya se cubre en escritorio, y las que miden 320 px
 * fijan su propio tamaño. Al mergear a main (E2E_FULL=1) y en local corren todas en ambos.
 */
const FULL_MOBILE = !process.env.CI || process.env.E2E_FULL === "1";
const MOBILE_ON_PR = ["navigation.spec.ts", "privacy-theme.spec.ts", "storage-overview.spec.ts", "inventory-controls.spec.ts", "skins.spec.ts"];

export default defineConfig({
  testDir: "e2e",
  testIgnore: ["local-build.spec.ts", "demo.spec.ts", "visual-tour.spec.ts", "visual-comparison.spec.ts"],
  fullyParallel: true,
  // Pocos a la vez: cada test levanta un navegador entero y la app anima bastante.
  workers: process.env.CI ? 2 : 3,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  // Un reintento en CI: lo que pasa al segundo intento queda marcado como inestable en el reporte, sin frenar el PR.
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
    {
      name: "celular",
      use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "chrome" },
      ...(FULL_MOBILE ? {} : { testMatch: MOBILE_ON_PR }),
    },
  ],
  webServer: {
    command: `npm start`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
