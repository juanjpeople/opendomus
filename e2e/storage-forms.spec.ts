import { expect, test } from "./fixtures";

test("los tipos se eligen con teclado sin perder el nombre y conservan una sola vista previa", async ({ home: page }, testInfo) => {
  await page.goto("/inventario");
  await page.getByRole("button", { name: "Nuevo recinto", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre", { exact: true }).fill("Patio chico");
  await dialog.getByRole("radio", { name: "Jardín", exact: true }).check();
  await expect(dialog.getByLabel("Nombre", { exact: true })).toHaveValue("Patio chico");
  await dialog.getByRole("button", { name: "Aceptar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Patio chico", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Agregar contenedor", exact: true }).first().click();
  await dialog.getByLabel("Nombre", { exact: true }).fill("Cables para revisar");
  await dialog.getByRole("radio", { name: "Caja", exact: true }).press("ArrowRight");
  await expect(dialog.getByRole("radio", { name: "Canasto", exact: true })).toBeChecked();
  await expect(dialog.getByLabel("Nombre", { exact: true })).toHaveValue("Cables para revisar");
  await expect(dialog.locator("[data-container-kind]")).toHaveCount(1);
  await expect(dialog.locator("[data-container-kind]")).toHaveAttribute("data-container-kind", "basket");
  // A tall fixed modal cannot be captured as one element: pixels outside the
  // viewport are clipped. Capture the two actual scrolled views instead.
  await dialog.getByRole("radio", { name: "Heladera", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("contenedor-tipos.png"), animations: "disabled" });
  await dialog.locator("[data-container-kind]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("contenedor-apariencia.png"), animations: "disabled" });
  await dialog.getByRole("button", { name: "Aceptar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  const created = page.getByRole("link", { name: /^Cables para revisar/ });
  await expect(created).toContainText("Canasto");
});
