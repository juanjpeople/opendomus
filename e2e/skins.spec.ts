import { expect, test } from "./fixtures";

test("el estilo se elige en Ajustes, se recuerda y se puede volver al de siempre", async ({ home: page }, testInfo) => {
  if (testInfo.project.name === "celular") await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/ajustes");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-skin", "casa");

  await page.getByRole("radio", { name: /Cálido/ }).click();
  await expect(html).toHaveAttribute("data-skin", "calido");
  // Elegir un estilo aplica su color de marca y su redondeo.
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuenow", "14");

  await page.goto("/inventario");
  await expect(html).toHaveAttribute("data-skin", "calido");
  await page.screenshot({ path: testInfo.outputPath("calido.png"), fullPage: true, animations: "disabled" });

  await page.goto("/ajustes");
  await page.getByRole("radio", { name: /Sobrio/ }).click();
  await expect(html).toHaveAttribute("data-skin", "sobrio");
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuenow", "2");
  await page.goto("/inventario");
  await page.screenshot({ path: testInfo.outputPath("sobrio.png"), fullPage: true, animations: "disabled" });

  await page.goto("/ajustes");
  await page.getByRole("radio", { name: /Casa/ }).click();
  await expect(html).toHaveAttribute("data-skin", "casa");
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuenow", "8");
});
