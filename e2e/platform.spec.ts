import { expect, test } from "./fixtures";

test("feedback es público y la administración no se publica", async ({ home: page }) => {
  await page.goto("/feedback");
  await expect(page.getByRole("heading", { name: "Ayudanos a mejorar OpenDomus" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar" })).toBeVisible();

  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Administración de OpenDomus" })).toHaveCount(0);
});
