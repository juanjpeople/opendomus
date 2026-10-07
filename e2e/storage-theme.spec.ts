import { expect, test } from "./fixtures";

for (const theme of ["light", "dark"] as const) {
  test(`almacenamiento respeta el tema ${theme}, letra grande y movimiento reducido`, async ({ home: page }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    if (testInfo.project.name === "celular") await page.setViewportSize({ width: 320, height: 780 });
    await page.goto("/ajustes");
    await page.getByRole("button", { name: "#722ed1", exact: true }).click();
    await page.getByRole("slider").press(theme === "light" ? "Home" : "End");
    await expect(page.getByRole("slider")).toHaveAttribute("aria-valuenow", theme === "light" ? "0" : "20");
    await page.getByTitle("Muy grande", { exact: true }).click();
    await page.getByText("Reducidas", { exact: true }).click();
    await page.goto("/inventario");
    const tile = page.getByRole("link", { name: /^Alacena/ });
    const scene = tile.locator("[data-container-kind]");
    await expect(scene).toBeVisible();
    const radius = await scene.evaluate(element => parseFloat(getComputedStyle(element).borderRadius));
    if (theme === "light") expect(radius).toBe(0);
    // Ant Design limita borderRadiusLG a 16 cuando el radio base es 20.
    else expect(radius).toBe(16);
    expect(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeGreaterThan(16);
    const capture = async (name: string) => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
      await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === "running" && animation.effect instanceof KeyframeEffect && animation.effect.getKeyframes().some(frame => frame.transform && frame.transform !== "none")).length)).toBe(0);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: testInfo.outputPath(`${theme}-${name}.png`), fullPage: true, animations: "disabled" });
    };
    await capture("plano");
    await tile.click();
    await expect(page.getByRole("heading", { name: "Alacena", exact: true })).toBeVisible();
    await capture("contenedor");
    await page.goto("/inventario/camara");
    await expect(page.getByRole("heading", { name: "Cámara", exact: true })).toBeVisible();
    await capture("camara");
    await page.getByRole("radiogroup", { name: "Modo de cámara" }).getByText("Escanear QR", { exact: true }).click();
    await expect(page.getByPlaceholder("Ej. K7QM")).toBeVisible();
    await capture("qr");
  });
}
