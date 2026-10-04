import { expect, test } from "@playwright/test";

test("estadísticas públicas sin consultar trackers ni servicios de GitHub desde el navegador", async ({ page }, testInfo) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== "localhost") external.push(request.url());
  });
  await page.goto("/bienvenida");
  const region = page.getByRole("region", { name: "Un proyecto abierto, con cifras claras" });
  await region.scrollIntoViewIfNeeded();
  await expect(region.locator("dt")).toHaveCount(4);
  await expect(region.getByText("Esta sección no mide tu actividad dentro de la app.", { exact: false })).toBeVisible();
  await expect(region.getByRole("link", { name: "Ver la fuente en GitHub" })).toHaveAttribute("href", "https://github.com/juanjpeople/opendomus");
  await expect(region.getByText(/Consultado el/)).toBeVisible();
  expect(external).toEqual([]);
  await region.screenshot({ path: testInfo.outputPath("project-stats.png") });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await region.screenshot({ path: testInfo.outputPath("project-stats-dark.png") });
});
