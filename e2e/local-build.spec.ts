import { expect, test } from "@playwright/test";

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
