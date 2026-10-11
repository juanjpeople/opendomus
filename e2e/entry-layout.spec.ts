import { expect, test } from "@playwright/test";

test("la entrada cabe en 320 px en ambos idiomas", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const language of ["ES", "EN"]) {
    await page.goto("/cuenta?modo=crear");
    await page.getByText(language, { exact: true }).click();
    await expect(page.getByRole("radio", { name: language, exact: true })).toBeChecked();
    for (const route of ["/cuenta?modo=crear", "/unirme", "/empezar"]) {
      await page.goto(route);
      await expect(page.getByRole("main").getByRole("heading").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      if (route.startsWith("/cuenta")) {
        expect(await page.getByRole("main").locator(".ant-segmented-item-label").evaluateAll((labels) => labels.every((label) => label.scrollWidth <= label.clientWidth))).toBe(true);
      }
      await page.screenshot({ path: testInfo.outputPath(`${language}-${route.split("?")[0].slice(1)}.png`), fullPage: true, animations: "disabled" });
    }
    await page.getByRole("button", { name: language === "ES" ? "Empezar acá" : "Start here", exact: true }).click();
    await expect(page.getByRole("button", { name: language === "ES" ? "Siguiente" : "Next", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.screenshot({ path: testInfo.outputPath(`${language}-configuracion.png`), fullPage: true, animations: "disabled" });
  }
});
