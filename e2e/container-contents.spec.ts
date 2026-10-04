import { expect, test } from "./fixtures";

test("un QR abre fotos y contenido libre del taller, también sin conexión", async ({ home: page, context }, testInfo) => {
  await page.goto("/inventario");
  await page.getByText("Estantería", { exact: true }).first().click();
  await page.waitForURL(/inventario\/ver\?id=/);
  const code = (await page.getByText(/Código [A-Z0-9]{4}/).innerText()).match(/Código ([A-Z0-9]{4})/)![1];
  await page.getByRole("textbox", { name: "Contenido guardado" }).fill("Cables sueltos");
  await page.getByRole("button", { name: "Anotar", exact: true }).click();
  await expect(page.getByText("Cables sueltos", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Editar anotación: Cables sueltos" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("Cables USB viejos");
  await page.getByRole("button", { name: "Guardar anotación", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("textbox", { name: "Contenido guardado" }).fill("Piezas por identificar");
  await page.getByRole("button", { name: "Anotar", exact: true }).click();
  await expect(page.getByText("Piezas por identificar", { exact: true })).toBeVisible();

  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 400; canvas.height = 240;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#c7975a"; ctx.fillRect(0, 0, 400, 240);
    ctx.strokeStyle = "#343b48"; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.ellipse(200, 120, 110, 65, 0, 0, Math.PI * 2); ctx.stroke();
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.locator('input[type="file"]').setInputFiles({ name: "cables.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await expect(page.locator(".od-photo-tile img")).toBeVisible();
  await expect(page.locator(".od-photo-tile img")).toHaveJSProperty("naturalWidth", 400);

  await page.reload();
  await expect(page.getByText("Cables USB viejos", { exact: true })).toBeVisible();
  await expect(page.locator(".od-photo-tile img")).toBeVisible();
  await page.getByRole("heading", { name: "Qué hay acá", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("container-light.png"), fullPage: true, animations: "disabled" });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.screenshot({ path: testInfo.outputPath("container-dark.png"), fullPage: true, animations: "disabled" });

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  // La ruta impresa /c/CODE debe resolver sin red, conservando las fotos locales.
  await context.setOffline(true);
  await page.goto(`/c/${code}`);
  await expect(page.getByText("Cables USB viejos", { exact: true })).toBeVisible();
  await expect(page.locator(".od-photo-tile img")).toHaveJSProperty("naturalWidth", 400);
  await page.getByRole("button", { name: "Eliminar anotación: Piezas por identificar" }).click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).last().click();
  await expect(page.getByText("Piezas por identificar", { exact: true })).toBeHidden();
});
