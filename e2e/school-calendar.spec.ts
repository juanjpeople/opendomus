import { expect, test } from "./fixtures";

test("elige país, agenda materias y tareas por hijo y respeta días sin clases", async ({ home: page }, testInfo) => {
  await page.clock.install({ time: new Date("2026-07-09T07:00:00-03:00") });
  await page.goto("/calendario");
  await page.getByText("Configurar feriados y escuela", { exact: true }).click();
  await page.getByRole("checkbox", { name: "Activar escuela: materias, mochila y tareas" }).check();
  await page.getByRole("combobox", { name: "País para los feriados", exact: true }).fill("Argentina");
  await page.getByRole("combobox", { name: "País para los feriados", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Guardar configuración", exact: true }).click();
  await expect(page.getByText("Feriado: Día de la Independencia", { exact: true }).first()).toBeVisible();

  async function create(kind: string, title: string) {
    await page.getByRole("button", { name: "Nuevo evento", exact: true }).filter({ hasText: "Nuevo evento" }).click();
    await page.getByLabel("Tipo de evento", { exact: true }).click();
    await page.locator(".ant-select-dropdown:visible").getByText(kind, { exact: true }).click();
    await page.getByLabel("Título", { exact: true }).fill(title);
    await page.getByLabel("Quiénes", { exact: true }).fill("Explorador");
    await page.getByLabel("Quiénes", { exact: true }).press("Enter");
    await page.getByLabel("Quiénes", { exact: true }).press("Escape");
  }
  await create("Materia escolar", "Matemática para la mochila");
  const until = page.getByLabel("Repetir hasta (fin del ciclo lectivo)", { exact: true });
  await until.fill("31/12/2026");
  await until.press("Enter");
  await page.getByLabel("Para la mochila: materiales y recordatorios", { exact: true }).fill("Cuaderno cuadriculado y regla");
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await create("Tarea escolar", "Revisar ejercicio 4");
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto("/");
  await expect(page.getByText("Escuela hoy · mochila y tareas", { exact: true })).toBeVisible();
  await expect(page.getByText("Cuaderno cuadriculado y regla", { exact: true })).toBeVisible();
  await expect(page.getByText(/Confirmá si hay clases/)).toBeVisible();
  await expect.poll(() => page.getByText("Cuaderno cuadriculado y regla", { exact: true }).evaluate((element) => {
    for (let node: Element | null = element; node; node = node.parentElement) if (Number(getComputedStyle(node).opacity) < 1) return false;
    return true;
  })).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("escuela.png"), fullPage: true });
  await page.getByRole("button", { name: "Marcar revisada", exact: true }).click();
  await expect(page.getByRole("button", { name: "Marcar revisada", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Cuaderno cuadriculado y regla", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Marcar revisada", exact: true })).toHaveCount(0);

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.context().setOffline(true);
  await page.goto("/calendario");
  await expect(page.getByText("Feriado: Día de la Independencia", { exact: true }).first()).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("Cuaderno cuadriculado y regla", { exact: true })).toBeVisible();
  await page.context().setOffline(false);

  await page.goto("/calendario");
  await create("Sin clases / vacaciones", "Jornada sin clases");
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByText("No hay materias programadas para hoy.", { exact: true })).toBeVisible();
  await expect(page.getByText("Cuaderno cuadriculado y regla", { exact: true })).toHaveCount(0);
});
