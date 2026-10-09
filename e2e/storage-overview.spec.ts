import { addNote, chooseView, expect, test } from "./fixtures";

test("el plano conserva la etiqueta y encuentra anotaciones sin tildes", async ({ home: page }, testInfo) => {
  if (testInfo.project.name === "celular") await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/inventario");
  await expect(page.getByRole("main").getByRole("link", { name: "Cámara", exact: true })).toHaveCount(1);
  await expect(page.getByRole("main").getByRole("link", { name: "Escanear", exact: true })).toHaveCount(0);
  // La vista elegida queda como la de este perfil.
  await chooseView(page, "Plano");
  const label = page.getByRole("button", { name: "Etiqueta: Alacena", exact: true });
  const box = await label.boundingBox();
  expect(Math.round(box?.width ?? 0)).toBeGreaterThanOrEqual(44);
  expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44);
  await label.click();
  await expect(page.getByRole("dialog", { name: "Imprimir etiqueta" })).toBeVisible();
  await expect(page).toHaveURL(/\/inventario$/);
  await page.getByRole("dialog").getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("link", { name: /^Alacena/ }).click();
  await addNote(page, "Café en frasco azul");
  await page.goto("/inventario");
  await expect(page.getByRole("button", { name: "Etiqueta: Alacena", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await page.screenshot({ path: testInfo.outputPath("plano.png"), fullPage: true, animations: "disabled" });
  await page.getByRole("textbox", { name: "¿Dónde guardé…?" }).fill("cafe azul");
  const result = page.getByRole("list").getByRole("link", { name: "Cocina › Alacena", exact: true });
  await expect(result).toBeVisible();
  await expect(result.locator("mark")).toHaveText(["Café", "azul"]);
  await expect(result).toHaveAttribute("href", /\/inventario\/ver\?id=/);
  await page.screenshot({ path: testInfo.outputPath("busqueda.png"), fullPage: true, animations: "disabled" });
  await result.click();
  await expect(page.getByText("Café en frasco azul", { exact: true })).toBeVisible();
});

test("se recorre sin perderse: lugar, recinto, contenedor, ficha y vuelta por la ruta tocable", async ({ home: page }, testInfo) => {
  if (testInfo.project.name === "celular") await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/inventario");
  // Lugares: cada recinto con sus muebles; el encabezado abre el recinto.
  await page.getByRole("link", { name: /^Taller de herramientas/ }).first().click();
  await expect(page).toHaveURL(/\/inventario\/lugar\?id=/);
  await expect(page.getByRole("heading", { name: "Taller de herramientas", exact: true })).toBeVisible();
  const path = page.getByRole("navigation", { name: "Dónde estás", exact: true });
  await expect(path.getByRole("link", { name: "Inventario", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /^Estantería de herramientas/ }).click();
  await expect(page).toHaveURL(/\/inventario\/ver\?id=/);
  await expect(path.getByRole("link", { name: "Taller de herramientas", exact: true })).toBeVisible();
  const up = path.getByRole("link", { name: "Taller de herramientas", exact: true });
  const box = await up.boundingBox();
  expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await page.screenshot({ path: testInfo.outputPath("contenedor.png"), fullPage: true, animations: "disabled" });
  await up.click();
  await expect(page).toHaveURL(/\/inventario\/lugar\?id=/);
  await path.getByRole("link", { name: "Inventario", exact: true }).click();
  await expect(page).toHaveURL(/\/inventario$/);
  // Recientes: lo último que se abrió queda a mano.
  await expect(page.getByRole("link", { name: /^Estantería de herramientas · Taller de herramientas/ })).toBeVisible();
});

test("la vista elegida se recuerda y la búsqueda de un producto abre su ficha", async ({ home: page }) => {
  await page.goto("/inventario");
  await chooseView(page, "Tarjetas");
  await expect(page.getByRole("combobox", { name: "Ordenar" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Ordenar" })).toBeVisible();
  await chooseView(page, "Lista");
  await expect(page.getByRole("link", { name: "Heladera", exact: true })).toBeVisible();
  // Ctrl+K y el buscador llevan a la ficha del producto, no solo a su caja.
  await page.getByRole("link", { name: "Heladera", exact: true }).click();
  await page.getByRole("button", { name: "Agregar producto", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: /^Agregar producto a / });
  await dialog.getByPlaceholder("Ej. Leche, Taladro, Pilas AA").fill("Queso rallado");
  await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
  await page.goto("/inventario");
  await page.getByRole("textbox", { name: "¿Dónde guardé…?" }).fill("queso");
  await page.getByRole("list").getByRole("link", { name: /^Abrir Queso rallado en Cocina › Heladera/ }).click();
  await expect(page).toHaveURL(/item=/);
  await expect(page.getByRole("dialog")).toContainText("Queso rallado");
  await expect(page.getByRole("dialog").getByRole("navigation", { name: "Dónde está", exact: true })).toContainText("Heladera");
  await page.getByRole("dialog").getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(page).not.toHaveURL(/item=/);
  // Ctrl+K: un producto abre su ficha, igual que el buscador.
  await page.goto("/inventario");
  await expect(page.getByRole("heading", { name: "Tus lugares", exact: true })).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Buscá páginas o acciones…").fill("queso rallado");
  await page.getByRole("option", { name: /^Queso rallado/ }).first().click();
  await expect(page).toHaveURL(/item=/);
  await expect(page.getByRole("dialog").filter({ hasText: "Dónde está" })).toContainText("Queso rallado");
});
