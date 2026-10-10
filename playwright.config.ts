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
 * En los PR corre solo lo esencial, en escritorio: entrar, armar la casa, inventario, escanear,
 * compras, recetas, respaldo, sin conexión y compartir. Lo demás (celular, temas, calendario,
 * estadísticas, opiniones, portada) corre al mergear a main (E2E_FULL=1) y en local.
 */
const FULL = !process.env.CI || process.env.E2E_FULL === "1";
// En CI, el celular repite solo lo que cambia de diseño en pantalla chica; en local, todo.
const CELULAR_CI = ["navigation.spec.ts", "storage-overview.spec.ts", "inventory-controls.spec.ts", "skins.spec.ts", "privacy-theme.spec.ts", "entry-layout.spec.ts"];
const MAIN_ONLY = ["school-calendar.spec.ts", "project-stats.spec.ts", "feedback.spec.ts", "skins.spec.ts", "storage-theme.spec.ts", "privacy-theme.spec.ts", "platform.spec.ts", "entry-layout.spec.ts", "landing.spec.ts"];

export default defineConfig({
  testDir: "e2e",
  testIgnore: ["local-build.spec.ts", "demo.spec.ts", "visual-tour.spec.ts", "visual-comparison.spec.ts", ...(FULL ? [] : MAIN_ONLY)],
  fullyParallel: true,
  // Dos navegadores en el mismo runner: no suma minutos de CI, los reduce a la mitad.
  // Más satura el runner gratuito y vuelve inestables las animaciones.
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
    ...(FULL ? [{ name: "celular", ...(process.env.CI ? { testMatch: CELULAR_CI } : {}), use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "chrome" } }] : []),
  ],
  webServer: {
    command: `npm start`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
