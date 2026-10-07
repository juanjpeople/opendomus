import { expect, test } from "@playwright/test";

test("una casa vacía no incorpora lugares ni artículos y no vuelve a preguntar", async ({ page }) => {
  await page.goto("/empezar");
  await page.getByRole("button", { name: "Empezar acá" }).click();
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Empezar sin precarga" }).click();
  await page.getByText("Administrador", { exact: true }).first().click();
  await page.goto("/inventario");
  await expect(page.getByText("Alacena", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Heladera", { exact: true })).toHaveCount(0);
  await page.goto("/empezar");
  await page.getByRole("button", { name: "Empezar acá" }).click();
  await expect(page).not.toHaveURL(/empezar/);
  await expect(page.getByRole("heading", { name: "¿Cómo querés empezar tu casa?" })).toHaveCount(0);
});

test("revisa un patrón, edita cantidades y excluye productos antes de guardarlos", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/empezar");
  await page.getByRole("button", { name: "Empezar acá" }).click();
  await page.getByRole("checkbox", { name: "Cocina", exact: true }).check();
  await page.getByRole("checkbox", { name: "Heladera", exact: true }).check();
  await page.getByRole("radio", { name: "Básicos a mano · mediados de mes" }).check();
  await page.getByRole("button", { name: "Heladera", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Cantidad de Huevos", exact: true }).fill("7");
  await page.getByRole("checkbox", { name: "Leche", exact: true }).uncheck();
  await expect(page.getByText("Huevos blancos grandes · 6 ud.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "DIA online · Argentina" }).first()).toHaveAttribute("href", /diaonline/);
  await page.screenshot({ path: testInfo.outputPath("precarga.png"), fullPage: true });
  await page.getByRole("button", { name: "Guardar esta selección" }).click();
  await page.getByText("Administrador", { exact: true }).first().click();
  await page.goto("/inventario");
  await expect(page.getByText("Taller de herramientas", { exact: true })).toHaveCount(0);
  await page.getByText("Heladera", { exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Ver detalle de Leche", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Ver detalle de Huevos", exact: true }).click();
  await expect(page.getByText("7", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Ver detalle de Huevos", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
