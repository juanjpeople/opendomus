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

  // Color and icon start folded behind the preview: the type's defaults are enough.
  const appearance = dialog.getByRole("button", { name: /Color e ícono del tipo/ });
  await expect(appearance).toHaveAttribute("aria-expanded", "false");
  await expect(dialog.getByRole("radio", { name: "Violeta", exact: true })).toBeHidden();
  await appearance.click();
  await dialog.getByRole("radio", { name: "Violeta", exact: true }).click();
  const chosen = dialog.getByRole("button", { name: /Color e ícono elegidos/ });
  await expect(chosen).toHaveAttribute("aria-expanded", "true");
  await dialog.locator("[data-container-kind]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("contenedor-apariencia.png"), animations: "disabled" });
  await chosen.click();
  await expect(chosen).toHaveAttribute("aria-expanded", "false");
  await chosen.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("contenedor-plegado.png"), animations: "disabled" });
  await dialog.getByRole("button", { name: "Aceptar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  const created = page.getByRole("link", { name: /^Cables para revisar/ });
  await expect(created).toContainText("Canasto");

  // Editing without opening the folded section keeps the chosen color.
  await created.click();
  await expect(page.getByRole("heading", { name: "Cables para revisar", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Más acciones", exact: true }).click();
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click();
  await expect(dialog.getByRole("button", { name: /Color e ícono elegidos/ })).toHaveAttribute("aria-expanded", "false");
  await dialog.getByLabel("Nombre", { exact: true }).fill("Cables revisados");
  await dialog.getByRole("button", { name: "Aceptar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Cables revisados", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Más acciones", exact: true }).click();
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click();
  await dialog.getByRole("button", { name: /Color e ícono elegidos/ }).click();
  await expect(dialog.getByRole("radio", { name: "Violeta", exact: true })).toBeChecked();
});
