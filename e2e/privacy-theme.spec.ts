import { expect, switchToKid, test } from "./fixtures";

function contrast(foreground: string, background: string) {
  const parse = (color: string) => color.match(/[\d.]+/g)!.map(Number);
  const bg = parse(background), fg = parse(foreground);
  const luminance = (rgb: number[]) => rgb.slice(0, 3).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const alpha = fg[3] ?? 1;
  const front = luminance(fg.map((value, i) => value * alpha + bg[i] * (1 - alpha)));
  const back = luminance(bg);
  return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05);
}

for (const theme of ["light", "dark"] as const) {
  test(`privacidad: contraste violeta, navegación y permisos · ${theme}`, async ({ home: page }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    if (testInfo.project.name === "celular") await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/ajustes");
    await page.getByRole("button", { name: "#722ed1", exact: true }).click();
    await page.getByTitle("Muy grande", { exact: true }).click();
    await page.getByText("Reducidas", { exact: true }).click();
    await page.goto("/proyectos");
    await page.getByRole("button", { name: "Nuevo proyecto" }).first().click();
    await page.getByPlaceholder("Ej. Renovación del baño").fill("Presupuesto familiar de adultos");
    await page.getByRole("dialog").getByText("Adultos", { exact: true }).click();
    await page.getByRole("button", { name: "Crear proyecto" }).click();
    await page.waitForURL(/proyectos\/ver/);
    await page.goto("/privacidad");
    const project = page.getByRole("link", { name: "Presupuesto familiar de adultos Proyecto", exact: true });
    await expect(project).toBeVisible();
    await project.focus();
    await expect(project).toBeFocused();
    await project.press("Enter");
    await expect(page).toHaveURL(/proyectos\/ver/);
    await page.goto("/privacidad");
    if (testInfo.project.name === "celular") await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
    const selected = page.getByRole("navigation", { name: "Principal", exact: true }).getByRole("link", { name: "Privacidad", exact: true });
    await expect(selected).toHaveAttribute("aria-current", "page");
    const colors = await selected.evaluate(element => ({ foreground: getComputedStyle(element).color, background: getComputedStyle(element.querySelector("span")!).backgroundColor }));
    expect(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
    if (testInfo.project.name === "celular") await selected.click();
    const eyebrow = await page.getByRole("main").locator("strong").first().evaluate(element => getComputedStyle(element).color);
    expect(contrast(eyebrow, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.screenshot({ path: testInfo.outputPath(`privacidad-${theme}.png`), fullPage: true, animations: "disabled" });
    await switchToKid(page, /Explorador/);
    await page.goto("/privacidad");
    await expect(page.getByRole("link", { name: /Presupuesto familiar de adultos/ })).toHaveCount(0);
  });
}
