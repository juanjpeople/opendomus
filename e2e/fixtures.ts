import { expect, test as base, type Page } from "@playwright/test";

/** Entra como Administrador en una casa nueva (cada test tiene su propio navegador, sin datos). */
async function signIn(page: Page) {
  await page.goto("/");
  await page.getByText("Administrador", { exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

/** Carga un producto en un contenedor (por nombre, desde el inventario). */
async function addItem(page: Page, container: string, name: string, quantity: number, min: number) {
  if (!page.url().includes("/inventario/ver")) {
    await page.goto("/inventario");
    await page.getByText(container, { exact: true }).first().click();
    await page.waitForURL(/inventario\/ver\?id=/);
  }
  await page.getByPlaceholder("Ej. Leche, Taladro, Pilas AA").fill(name);
  await page.getByLabel("Cantidad").fill(String(quantity));
  await page.getByLabel("Mínimo").fill(String(min));
  await page.getByRole("button", { name: "Agregar", exact: true }).click();
  await expect(page.getByRole("button", { name: `Ver detalle de ${name}` })).toBeVisible();
}

export const test = base.extend<{ home: Page }>({
  // `provide` es el `use` de Playwright (con otro nombre: no es un hook de React).
  home: async ({ page }, provide) => {
    // Un error de la app en la consola hace fallar el test (los 404 de recursos esperados no cuentan).
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await signIn(page);
    await provide(page);
    expect(errors, "errores de la app en la consola").toEqual([]);
  },
});

export { addItem, expect };
