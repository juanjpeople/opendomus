import { expect, test } from "./fixtures";

test("feedback y administración cargan como páginas públicas", async ({ home: page }) => {
  await page.goto("/feedback");
  await expect(page.getByRole("heading", { name: "Ayudanos a mejorar OpenDomus" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar" })).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Administración de OpenDomus" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ya tengo cuenta" })).toHaveAttribute(
    "href",
    "/cuenta?modo=entrar&volver=/admin",
  );
});
