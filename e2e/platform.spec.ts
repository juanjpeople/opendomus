import { expect, test } from "./fixtures";

test("feedback y formulario de operador no exponen datos privados", async ({ home: page }) => {
  await page.goto("/feedback");
  await expect(page.getByRole("heading", { name: "Ayudanos a mejorar Refugiar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar" })).toBeVisible();

  const response = await page.goto("/admin");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Acceso de operador" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Administración de Refugiar" })).toHaveCount(0);
});
