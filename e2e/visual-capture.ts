import { expect, type Locator, type Page } from "@playwright/test";

/** Activa Reveal al recorrer los títulos y espera su estado final, sin congelar RAF. */
export async function settleCapture(page: Page, area = page.locator("body")) {
  await page.evaluate(async () => { await document.fonts.ready; });
  // HouseMark dibuja con JS: animations:disabled solo detiene animaciones CSS/WAAPI.
  const houseWindow = page.locator('svg:has(path[d="M5 10.5 V20 H19 V10.5"]) rect').first();
  if (await houseWindow.count()) await expect(houseWindow).toHaveCSS("opacity", "1");
  const appeared = async (target: Locator) => {
    await expect.poll(() => target.evaluate(element => {
      for (let node: Element | null = element; node; node = node.parentElement) {
        if (Number(getComputedStyle(node).opacity) !== 1) return `${element.textContent}: ${node.tagName} opacity=${getComputedStyle(node).opacity}`;
      }
      return true;
    })).toBe(true);
  };
  for (const heading of await area.locator("h1,h2,h3,h4,h5").all()) {
    if (!await heading.isVisible()) continue;
    await heading.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
    await appeared(heading);
  }
  await area.scrollIntoViewIfNeeded();

}
