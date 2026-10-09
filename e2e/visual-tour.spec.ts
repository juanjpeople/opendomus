import { expect, test } from "@playwright/test";
import { settleCapture } from "./visual-capture";

// Evidence for the visual migration, using the isolated demo build. These are
// reviewable captures, not pixel assertions against a machine-specific font.
for (const colorScheme of ["light", "dark"] as const) {
  test(`recorrido visual · ${colorScheme}`, async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    const capture = async (name: string) => {
      await settleCapture(page);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: testInfo.outputPath(`${colorScheme}-${name}.png`), fullPage: true, animations: "disabled" });
    };

    for (const route of ["bienvenida", "empezar", "cuenta", "unirme"]) {
      await test.step(route, async () => {
        await page.goto(`/${route}`);
        await expect(page.getByRole("heading").first()).toBeVisible();
        await capture(route);
      });
    }
    await page.goto("/empezar");
    await page.getByRole("button", { name: "Explorar casa demo", exact: true }).click();
    await page.getByRole("heading", { name: "Administrador", exact: true }).click();
    await expect(page.getByRole("button", { name: "Casa demo · datos ficticios", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await capture("tablero");

    await page.goto("/design");
    for (const section of ["principios", "tokens", "tipografia", "firma", "movimiento", "voz", "botones", "feedback", "formularios", "tablas", "componentes-estructura", "componentes-estados", "componentes-seleccion", "componentes-datos", "componentes-espacios", "componentes-entrada", "flujo-almacenamiento", "flujo-catalogo", "flujo-recetas", "flujo-entrada", "revision", "permisos", "can", "servicios"]) {
      await test.step(`design: ${section}`, async () => {
        const block = page.locator(`#${section}`);
        await expect(block).toBeVisible();
        await settleCapture(page, block);
        await block.screenshot({ path: testInfo.outputPath(`${colorScheme}-design-${section}.png`), animations: "disabled", style: "header { visibility: hidden !important; }" });
      });
    }
    const providers = page.getByRole("group", { name: "Acceso con proveedores", exact: true });
    await providers.getByRole("button", { name: "Vincular GitHub", exact: true }).click();
    await expect(providers.getByRole("button", { name: "GitHub vinculado", exact: true })).toBeDisabled();
    await providers.getByRole("checkbox", { name: "Simular espera" }).check();
    await expect(providers.getByRole("button", { name: "Continuar con Google", exact: true })).toBeDisabled();
    await providers.getByRole("checkbox", { name: "Simular espera" }).uncheck();
    await providers.getByRole("button", { name: "Reiniciar ejemplo" }).click();
    const storage = page.locator("#flujo-almacenamiento");
    await storage.getByText("2 · Recinto", { exact: true }).click();
    await expect(storage.getByRole("heading", { name: "Taller", exact: true })).toBeVisible();
    await settleCapture(page, storage);
    await storage.screenshot({ path: testInfo.outputPath(`${colorScheme}-design-recinto.png`), animations: "disabled", style: "header { visibility: hidden !important; }" });
    await storage.getByText("3 · Contenedor", { exact: true }).click();
    await expect(storage.getByRole("heading", { name: "Alacena", exact: true })).toBeVisible();
    await settleCapture(page, storage);
    await storage.screenshot({ path: testInfo.outputPath(`${colorScheme}-design-contenedor.png`), animations: "disabled", style: "header { visibility: hidden !important; }" });
    await storage.getByText("4 · Ficha", { exact: true }).click();
    await expect(storage.getByRole("navigation", { name: "Dónde está", exact: true })).toBeVisible();
    await settleCapture(page, storage);
    await storage.screenshot({ path: testInfo.outputPath(`${colorScheme}-design-ficha.png`), animations: "disabled", style: "header { visibility: hidden !important; }" });
    await storage.getByText("5 · Cámara", { exact: true }).click();
    await expect(storage.getByRole("heading", { name: "Cámara", exact: true })).toBeVisible();
    for (const mode of ["Escanear QR", "Buscar", "AR espacial"]) {
      await storage.getByText(mode, { exact: true }).click();
      await expect(storage.getByRole("radio", { name: new RegExp(`^${mode}`) })).toBeChecked();
      await settleCapture(page, storage);
      await storage.screenshot({ path: testInfo.outputPath(`${colorScheme}-design-camara-${mode}.png`), animations: "disabled", style: "header { visibility: hidden !important; }" });
    }
    for (const route of ["inventario", "inventario/camara", "inventario/escanear", "compras", "recetas", "calendario", "familia", "proyectos", "ajustes", "feedback"]) {
      await test.step(route, async () => {
        await page.goto(`/${route}`);
        await expect(page.getByRole("main").getByRole("heading").first()).toBeVisible();
        await capture(route.replaceAll("/", "-"));
      });
    }
    await page.goto("/inventario");
    await page.getByRole("link", { name: /^Taller/ }).first().click();
    await expect(page.getByRole("heading", { name: "Taller", exact: true })).toBeVisible();
    await capture("recinto");
    await page.getByRole("link", { name: /^Caja de recuerdos y piezas sueltas/ }).first().click();
    await expect(page.getByText("Tres cables USB viejos para revisar", { exact: true })).toBeVisible();
    await capture("contenedor");
  });
}
