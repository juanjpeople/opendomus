import { expect, test } from "@playwright/test";

test("las cabeceras conservan la marca y los controles a 320 px", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const waitForDrawing = () => expect.poll(() => page.locator('svg path[pathLength="1"]').evaluateAll((paths) =>
    paths.every((path) => parseFloat(getComputedStyle(path).strokeDasharray) >= 0.99),
  )).toBe(true);
  const checkBrand = async () => {
    const brand = page.getByText("Refugiar", { exact: true }).first();
    await expect(brand).toBeVisible();
    const bounds = await brand.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const lines = range.getClientRects();
      const rect = element.getBoundingClientRect();
      return { lines: lines.length, left: rect.left, right: rect.right, width: innerWidth };
    });
    expect(bounds.lines).toBe(1);
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.width);
    await expect(page.getByText("EN", { exact: true }).first()).toBeVisible();
  };
  for (const route of ["bienvenida", "empezar"]) {
    await page.goto(`/${route}`);
    await checkBrand();
    await waitForDrawing();
    await page.screenshot({ path: testInfo.outputPath(`${route}-320.png`), animations: "disabled" });
  }
  await page.getByRole("button", { name: "Empezar acá" }).click();
  await page.getByRole("button", { name: "Empezar sin precarga" }).click();
  const profile = page.getByText("Administrador", { exact: true }).first();
  await expect(profile).toBeVisible();
  await expect.poll(() => profile.evaluate((element) => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      if (Number(getComputedStyle(node).opacity) < 0.99) return false;
    }
    return true;
  })).toBe(true);
  await checkBrand();
  await waitForDrawing();
  await page.screenshot({ path: testInfo.outputPath("profiles-320.png"), animations: "disabled" });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: testInfo.outputPath("profiles-320-dark.png"), animations: "disabled" });
});

test("la distribución local funciona sin API ni formularios cloud", async ({ page, request }) => {
  const info = await request.get("/build-info.json");
  expect((await info.json()).localOnly).toBe(true);
  const apiRequests: string[] = [];
  page.on("request", (req) => {
    if (new URL(req.url()).pathname.startsWith("/api/")) apiRequests.push(req.url());
  });
  for (const route of ["/cuenta?modo=crear", "/cuenta?modo=recuperar", "/unirme#test.secret", "/feedback"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: "Esta instalación funciona sin servidor" })).toBeVisible();
    await expect(page.getByRole("main").locator("input, textarea")).toHaveCount(0);
  }
  await page.getByRole("link", { name: "Continuar en este dispositivo" }).click();
  await expect(page.getByRole("link", { name: "Crear cuenta", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Empezar acá" }).click();
  await page.getByRole("button", { name: "Empezar sin precarga" }).click();
  await expect(page.getByText("¿Quién está en casa?")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Administrador", { exact: true }).first()).toBeVisible();
  expect(apiRequests).toEqual([]);
});

test("las rutas exportadas y los metadatos se revalidan", async ({ request }) => {
  for (const route of ["/cuenta", "/empezar", "/sw.js", "/build-info.json"]) {
    const response = await request.get(route);
    expect(response.ok()).toBe(true);
    expect(response.headers()["cache-control"]).toContain("no-cache");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  }
  const html = await (await request.get("/cuenta")).text();
  const asset = html.match(/src="([^"]*\/_next\/static\/[^"]+\.js)"/)?.[1];
  expect(asset).toBeTruthy();
  const response = await request.get(asset!);
  expect(response.ok()).toBe(true);
  expect(response.headers()["cache-control"]).toContain("immutable");
});
