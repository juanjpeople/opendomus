import { addItem, expect, test } from "./fixtures";

test("una receta vinculada sabe qué falta, lo anota y descuenta al cocinarla", async ({ home: page }) => {
  await addItem(page, "Heladera", "Huevos", 2, 6);

  await page.goto("/recetas/editar");
  await page.getByPlaceholder("Ej. Tarta de zapallitos").fill("Tortilla");
  await page.getByRole("combobox", { name: "Ingrediente" }).first().fill("hue");
  await page.locator(".ant-select-dropdown:visible").getByText("Huevos", { exact: true }).click();
  await page.getByRole("spinbutton", { name: "Cantidad" }).first().fill("4");
  await page.getByRole("textbox", { name: "Paso 1" }).fill("Batir y cocinar.");
  await page.getByRole("button", { name: "Guardar receta" }).first().click();
  await page.waitForURL(/recetas\/ver\?id=/);

  await expect(page.getByText("Falta poco").or(page.getByText("Faltan cosas")).first()).toBeVisible();
  await page.getByRole("button", { name: /Agregar lo que falta/ }).click();
  await expect(page.getByText("1 ingrediente anotado en la lista de compras")).toBeVisible();

  await page.getByRole("button", { name: "Cociné esto" }).click();
  await page.getByRole("button", { name: "Listo, descontar" }).click();
  await expect(page.locator(".ant-modal-confirm-title", { hasText: "Algo no alcanzó" })).toBeVisible();
});
