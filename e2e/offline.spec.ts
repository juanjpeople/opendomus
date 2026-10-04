import { expect, test } from "./fixtures";

test("instalada, funciona sin conexión (también los QR impresos)", async ({ home: page, context }, testInfo) => {
  test.skip(testInfo.project.name === "celular", "Una vez alcanza: el service worker es el mismo");
  await page.goto("/inventario");
  await page.getByText("Heladera", { exact: true }).first().click();
  await page.waitForURL(/inventario\/ver\?id=/);
  const containerUrl = page.url();
  const code = (await page.getByText(/Código [A-Z0-9]{4}/).innerText()).match(/Código ([A-Z0-9]{4})/)![1];

  // El service worker toma el control y guarda las páginas.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.waitForTimeout(2_000);

  await context.setOffline(true);
  await page.goto(containerUrl);
  await expect(page.getByRole("heading", { name: "Heladera", exact: true })).toBeVisible();
  await page.goto(`/c/${code}`);
  await expect(page.getByRole("heading", { name: "Heladera", exact: true })).toBeVisible();
  await page.goto("/recetas");
  await expect(page.getByRole("heading", { level: 2 }).first()).toContainText("Recetas");
  await expect(page.getByText("Sin conexión")).toBeVisible();
  await page.goto("/third-party-notices.txt");
  await expect(page.locator("body")).toContainText("jsqr 1.4.0");
  await expect(page.locator("body")).toContainText("Apache License");
  await expect(page.locator("body")).toContainText("@capacitor/core 8.4.3");
});
