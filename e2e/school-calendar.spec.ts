import { expect, test } from "./fixtures";

test("elige país, agenda materias y tareas por hijo y respeta días sin clases", async ({ home: page }, testInfo) => {
  // Playwright's clock also replaces performance/RAF, even with setFixedTime.
  // Motion's native animations need those to share the document timeline.
  // Fix Date alone, before the next document loads, leaving real timers intact.
  await page.addInitScript(({ now }) => {
    const OriginalDate = Date;
    window.Date = new Proxy(OriginalDate, {
      construct(target, args) {
        return Reflect.construct(target, args.length ? args : [now]);
      },
      apply() {
        return new OriginalDate(now).toString();
      },
      get(target, property, receiver) {
        return property === "now" ? () => now : Reflect.get(target, property, receiver);
      },
    });
  }, { now: new Date("2026-07-09T07:00:00-03:00").getTime() });
  await page.goto("/calendario");
  await page.getByText("Configurar feriados y escuela", { exact: true }).click();
  await page.getByRole("checkbox", { name: "Usar la agenda escolar" }).check();
  await page.getByRole("combobox", { name: "País para los feriados", exact: true }).fill("Argentina");
  await page.getByRole("combobox", { name: "País para los feriados", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Guardar configuración", exact: true }).click();
  await expect(page.getByText("Feriado: Día de la Independencia", { exact: true }).first()).toBeVisible();

  async function create(kind: string, title: string) {
    await page.getByRole("button", { name: "Nuevo evento", exact: true }).filter({ hasText: "Nuevo evento" }).click();
    // El menú está en un portal: puede parecer estable mientras el modal aún
    // termina de entrar. Esperar la transición completa antes de abrirlo.
    await expect.poll(() => page.getByRole("dialog").evaluate(element =>
      element.getAnimations({ subtree: true }).every(animation => animation.playState === "finished"),
    )).toBe(true);
    await page.getByLabel("Tipo de evento", { exact: true }).click();
    const menu = page.locator(".ant-select-dropdown:visible");
    await expect.poll(() => menu.evaluate(element =>
      element.getAnimations({ subtree: true }).every(animation => animation.playState === "finished"),
    )).toBe(true);
    await menu.getByText(kind, { exact: true }).click();
    await expect(page.getByLabel("Tipo de evento", { exact: true }).locator("..")).toContainText(kind);
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
  await expect(page.getByText("Revisar tarea: Revisar ejercicio 4", { exact: false })).toBeVisible();
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


test("escuela en inglés: validación, guardado único y ancho de 320 px", async ({ home: page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/ajustes");
  await page.getByText("English", { exact: true }).click();
  await page.goto("/calendario");
  await page.getByText("Configure holidays and school", { exact: true }).click();
  await page.getByRole("checkbox", { name: "Use the school planner" }).check();
  await page.getByRole("button", { name: "Save settings", exact: true }).click();
  await expect(page.getByText("Calendar configured", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New event", exact: true }).filter({ hasText: "New event" }).click();
  await page.getByLabel("Event type", { exact: true }).click();
  await page.locator(".ant-select-dropdown:visible").getByText("School subject", { exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Science club");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Choose who attends this class", { exact: true })).toBeVisible();
  await expect(page.getByText("Choose the end of term", { exact: true })).toBeVisible();
  await page.getByLabel("Who", { exact: true }).fill("Explorador");
  await page.getByLabel("Who", { exact: true }).press("Enter");
  await page.getByLabel("Who", { exact: true }).press("Escape");
  await page.getByLabel("Repeat until (end of school term)", { exact: true }).fill("31/12/2030");
  await page.getByLabel("Repeat until (end of school term)", { exact: true }).press("Enter");
  await page.getByLabel("For the backpack: materials and reminders", { exact: true }).fill("Notebook");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.locator(".ant-modal-wrap").evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: testInfo.outputPath("school-subject-en.png"), animations: "disabled" });
  await page.getByRole("button", { name: "Save changes", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Science club/ })).toHaveCount(1);
  await page.goto("/");
  await expect(page.getByText("School today · backpack and homework", { exact: true })).toBeVisible();
  await expect(page.getByText("Notebook", { exact: true })).toBeVisible();
});
