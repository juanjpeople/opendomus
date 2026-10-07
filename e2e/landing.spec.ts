import { expect, test } from "@playwright/test";

for (const colorScheme of ["light", "dark"] as const) {
  test(`portada: accesos y cifras en 320 px · ${colorScheme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    for (const language of ["ES", "EN"]) {
      await page.goto("/bienvenida");
      await page.getByText(language, { exact: true }).click();
      await expect(page.getByRole("radio", { name: language, exact: true })).toBeChecked();
      const demo = page.getByRole("link", { name: language === "ES" ? "Explorar casa demo" : "Explore demo home", exact: true });
      await expect(demo).toHaveAttribute("href", "/empezar?house=demo");
      await expect(page.getByRole("link", { name: language === "ES" ? "Ya tengo cuenta" : "I have an account", exact: true })).toHaveAttribute("href", "/cuenta?modo=entrar");
      const stats = page.locator('section[aria-labelledby="project-stats-title"]');
      await stats.scrollIntoViewIfNeeded();
      await expect(stats.getByRole("heading", { level: 2 })).toBeVisible();
      await expect(stats.getByRole("link")).toHaveAttribute("href", "https://github.com/juanjpeople/opendomus");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      await stats.screenshot({ path: testInfo.outputPath(`${language}-${colorScheme}-cifras.png`), animations: "disabled", style: "header { visibility: hidden !important; }" });
    }
  });
}
