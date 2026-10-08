import { expect, test as base, type Page } from "@playwright/test";

/** Entra como Administrador en una casa nueva de este dispositivo (cada test tiene su propio navegador, sin datos). */
async function signIn(page: Page) {
  await page.goto("/empezar");
  await page.getByRole("button", { name: "Empezar acá" }).click();
  await selectTestSpaces(page);
  await page.getByText("Administrador", { exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

export async function selectTestSpaces(page: Page) {
  for (const name of ["Cocina", "Taller de herramientas", "Heladera", "Alacena", "Estantería de herramientas"]) await page.getByRole("checkbox", { name, exact: true }).check();
  await page.getByRole("button", { name: "Guardar esta selección" }).click();
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

/**
 * Pasa a un perfil infantil desde el menú de la cabecera. En CI el clic a veces sale antes de que
 * el desplegable termine de ubicarse y se pierde: se reintenta hasta ver el modo Explorador.
 */
export async function switchToKid(page: Page, profile: RegExp) {
  const item = page.getByRole("menuitem", { name: profile }).first();
  await expect(async () => {
    if (!(await item.isVisible())) await page.getByRole("button", { name: "Cambiar de perfil", exact: true }).click();
    await item.click({ timeout: 2_000 });
    await expect(page.getByText("¡Modo Explorador!", { exact: true })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
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
