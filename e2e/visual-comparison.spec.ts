import { expect, test } from "@playwright/test";
import { settleCapture } from "./visual-capture";

// Solo puntos comunes entre f7089e6 y la revisión. Las piezas nuevas están en visual-tour.
for (const colorScheme of ["light", "dark"] as const) {
  test(`comparación visual · ${colorScheme}`, async ({ page, request }, testInfo) => {
    const build = await request.get("/build-info.json");
    expect(build.ok()).toBe(true);
    expect(await build.json()).toMatchObject({ demo: true });
    await testInfo.attach("build-info", { body: await build.body(), contentType: "application/json" });
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    const capture = async (name: string) => {
      await settleCapture(page);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: testInfo.outputPath(`${colorScheme}-${name}.png`), fullPage: true, animations: "disabled" });
    };
    for (const route of ["bienvenida", "empezar", "cuenta", "unirme"]) {
      await page.goto(`/${route}`);
      await expect(page.getByRole("heading").first()).toBeVisible();
      await capture(route);
    }
    await page.goto("/empezar");
    await page.getByRole("button", { name: "Explorar casa demo", exact: true }).click();
    await page.getByRole("heading", { name: "Administrador", exact: true }).click();
    await expect(page.getByText("Casa demo · datos ficticios", { exact: true }).or(page.getByRole("button", { name: "Casa demo · datos ficticios", exact: true }))).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await capture("tablero");
    for (const route of ["inventario", "inventario/camara", "inventario/escanear", "compras", "recetas", "calendario", "familia", "proyectos", "privacidad", "ajustes", "feedback"]) {
      await page.goto(`/${route}`);
      await expect(page.getByRole("main").getByRole("heading").first()).toBeVisible();
      await capture(route.replaceAll("/", "-"));
    }
    await page.goto("/inventario");
    await page.getByRole("link", { name: /^Caja de recuerdos y piezas sueltas/ }).click();
    await expect(page.getByText("Tres cables USB viejos para revisar", { exact: true })).toBeVisible();
    await capture("contenedor");
    await page.goto("/design");
    for (const section of ["principios", "tokens", "tipografia", "firma", "movimiento", "voz", "botones", "feedback", "formularios", "tablas", "componentes-estructura", "componentes-estados", "componentes-seleccion", "componentes-datos", "componentes-espacios", "flujo-almacenamiento", "flujo-recetas", "revision", "permisos", "can", "servicios"]) {
      const block = page.locator(`#${section}`);
      await expect(block).toBeVisible();
      await settleCapture(page, block);
      await block.screenshot({ path: testInfo.outputPath(`${colorScheme}-design-${section}.png`), animations: "disabled", style: "header { visibility: hidden !important; }" });
    }
  });
}
