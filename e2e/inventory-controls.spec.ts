import { addItem, expect, test } from "./fixtures";

test("las filas conservan cantidades, deshacer e historial en móvil", async ({ home: page }, testInfo) => {
  if (testInfo.project.name === "celular") await page.setViewportSize({ width: 320, height: 740 });
  await addItem(page, "Alacena", "Repuesto especial", 2, 1);
  const consume = page.getByRole("button", { name: "Usé uno de Repuesto especial", exact: true });
  const target = await consume.boundingBox();
  expect(Math.round(target?.width ?? 0)).toBeGreaterThanOrEqual(44);
  expect(Math.round(target?.height ?? 0)).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await consume.click();
  await expect(page.getByText("Usaste 1 unidad de Repuesto especial. Quedan 1.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  // Recargar antes de que se guarde el deshacer lo pierde.
  await expect(page.getByText("Cambio deshecho", { exact: true })).toBeVisible();
  await page.reload();
  await consume.click();
  await expect(page.getByText("Usaste 1 unidad de Repuesto especial. Quedan 1.", { exact: true })).toBeVisible();
  await consume.click();
  await expect(consume).toBeDisabled();
  await page.getByRole("button", { name: "Sumar uno", exact: true }).click();
  await expect(consume).toBeEnabled();
  await page.getByRole("button", { name: "Ver detalle de Repuesto especial", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Más acciones", exact: true }).click();
  await page.getByRole("menuitem", { name: "Historial", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Repuesto especial").first()).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("productos.png"), fullPage: true, animations: "disabled" });
});
