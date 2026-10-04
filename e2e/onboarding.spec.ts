import { expect, test } from "@playwright/test";

test("la primera vez arranca por la landing y la bienvenida; después, directo a la casa", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/bienvenida/);

  await page.getByRole("link", { name: "Empezar" }).first().click();
  await expect(page).toHaveURL(/empezar/);
  // La nube todavía no está: se ve el camino, pero no se puede elegir.
  await expect(page.getByRole("button", { name: "Estamos terminándolo" })).toHaveCount(2);

  await page.getByRole("button", { name: "Empezar acá" }).click();
  await expect(page.getByText("¿Quién está en casa?")).toBeVisible();
  await expect(page.getByText("Este dispositivo")).toBeVisible();
  await page.getByText("Administrador", { exact: true }).first().click();

  await page.goto("/");
  await expect(page).not.toHaveURL(/bienvenida/);
  await page.goto("/bienvenida");
  await expect(page.getByRole("link", { name: "Ir a mi casa" }).first()).toBeVisible();
});
