import { addItem, expect, test } from "./fixtures";

for (const privacy of ["Privado", "Adultos"]) {
  test(`crear una lista desde un proyecto ${privacy} conserva la privacidad inicial`, async ({ home: page }) => {
    await page.goto("/proyectos");
    await page.getByRole("button", { name: "Nuevo proyecto" }).first().click();
    await page.getByPlaceholder("Ej. Renovación del baño").fill(`Proyecto ${privacy}`);
    await page.getByRole("dialog").getByText(privacy, { exact: true }).click();
    await page.getByRole("button", { name: "Crear proyecto" }).click();
    await page.waitForURL(/proyectos\/ver/);
    const projectUrl = page.url();
    await page.getByRole("button", { name: "Nueva lista" }).click();
    await expect(page.getByRole("radio", { name: privacy, exact: true })).toBeChecked();
    await page.getByPlaceholder("Ej. Sanitarios, Herramientas de jardín").fill(`Lista ${privacy}`);
    await page.getByRole("button", { name: "Crear lista" }).click();
    await page.waitForURL(/compras\?lista=/);
    await page.reload();
    await page.getByRole("button", { name: "Editar lista", exact: true }).click();
    await expect(page.getByRole("radio", { name: privacy, exact: true })).toBeChecked();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();

    // La persona puede elegir compartir otra lista sin cambiar el proyecto.
    await page.goto(projectUrl);
    await page.getByRole("button", { name: "Nueva lista" }).click();
    await expect(page.getByRole("radio", { name: privacy, exact: true })).toBeChecked();
    await page.getByRole("dialog").getByText("Familia", { exact: true }).click();
    await page.getByPlaceholder("Ej. Sanitarios, Herramientas de jardín").fill("Lista compartida");
    await page.getByRole("button", { name: "Crear lista" }).click();
    await page.waitForURL(/compras\?lista=/);
    await page.getByRole("button", { name: "Editar lista", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Familia", exact: true })).toBeChecked();
  });
}

test("lo que se consume entra en 'Para revisar', se suma a la lista y al comprarlo se repone", async ({ home: page }) => {
  await addItem(page, "Heladera", "Leche", 3, 2);
  // Usé dos veces: 3 → 1, cruza el mínimo.
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Usé uno de Leche" }).click();
  await expect(page.getByText("Usaste 1 unidad de Leche. Quedan 1.")).toBeVisible();

  await page.goto("/compras");
  await expect(page.getByText("Leche")).toBeVisible();
  await page.getByRole("button", { name: "1", exact: true }).first().click(); // "+1": sumar a la lista
  await expect(page.getByRole("checkbox", { name: "Marcar Leche como comprado" })).toBeVisible();

  await page.getByRole("checkbox", { name: "Marcar Leche como comprado" }).click();
  await expect(page.getByText("+1 al inventario")).toBeVisible();
  await expect(page.getByText("Nada para revisar")).toBeVisible();
});

test("una lista de proyecto suma lo pagado y lo estimado contra el presupuesto", async ({ home: page }) => {
  await page.goto("/proyectos");
  await page.getByRole("button", { name: "Nuevo proyecto" }).first().click();
  await page.getByPlaceholder("Ej. Renovación del baño").fill("Renovación del baño");
  await page.locator(".ant-modal .ant-input-number-input").first().fill("500000");
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await page.waitForURL(/proyectos\/ver/);

  await page.getByRole("button", { name: "Nueva lista" }).click();
  await page.getByPlaceholder("Ej. Sanitarios, Herramientas de jardín").fill("Sanitarios");
  await page.locator(".ant-modal .ant-input-number-input").first().fill("100000");
  await page.getByRole("button", { name: "Crear lista" }).click();
  await page.waitForURL(/compras\?lista=/);

  const add = page.getByRole("combobox", { name: "¿Qué hay que comprar?" });
  await add.fill("Inodoro");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Estimar precio" }).first().click();
  await page.locator(".ant-popover:visible .ant-input-number-input").fill("80000");
  await page.locator(".ant-popover:visible").getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Quedan $ 20.000,00")).toBeVisible();

  await page.getByRole("checkbox", { name: "Marcar Inodoro como comprado" }).click();
  await page.getByRole("button", { name: "¿Cuánto salió?" }).first().click();
  await page.locator(".ant-popover:visible .ant-input-number-input").fill("120000");
  await page.locator(".ant-popover:visible").getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Te pasás por $ 20.000,00")).toBeVisible();

  await page.goto("/proyectos");
  await expect(page.getByText("$ 120.000,00")).toBeVisible();
});
