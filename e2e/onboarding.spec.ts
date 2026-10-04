import { expect, test } from "@playwright/test";

test("la primera vez arranca por la landing y la bienvenida; después, directo a la casa", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/bienvenida/);

  await page.getByRole("link", { name: "Empezar" }).first().click();
  await expect(page).toHaveURL(/empezar/);
  // En el dispositivo es gratis; la nube es opcional y está en beta por invitación (pide un código).
  await expect(page.getByText("Gratis", { exact: true })).toBeVisible();
  await expect(page.getByText("Beta · por invitación")).toBeVisible();
  await page.getByRole("button", { name: "Crear mi casa" }).click();
  await expect(page).toHaveURL(/cuenta/);
  await expect(page.getByRole("heading", { name: "Código de acceso" })).toBeVisible();
  await page.goBack();

  await page.getByRole("button", { name: "Empezar acá" }).click();
  await expect(page.getByText("¿Quién está en casa?")).toBeVisible();
  await expect(page.getByText("Este dispositivo")).toBeVisible();
  await page.getByText("Administrador", { exact: true }).first().click();

  await page.goto("/");
  await expect(page).not.toHaveURL(/bienvenida/);
  await page.goto("/bienvenida");
  await expect(page.getByRole("link", { name: "Ir a mi casa" }).first()).toBeVisible();
});
