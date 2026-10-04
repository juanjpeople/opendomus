import { test, expect } from "./fixtures";

test("cámara: libera un permiso que llega después de salir de la pantalla", async ({ home: page }) => {
  await page.addInitScript(() => {
    const state = { stopped: 0, grant: () => {} };
    Object.assign(window, { cameraTest: state, BarcodeDetector: class { async detect() { return []; } } });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: () => new Promise<MediaStream>(resolve => {
      state.grant = () => { const stream = new MediaStream(); stream.getTracks = () => [{ stop: () => state.stopped++ } as unknown as MediaStreamTrack]; resolve(stream); };
    }) });
  });
  await page.goto("/inventario/escanear");
  await page.getByRole("button", { name: "Activar cámara" }).click();
  await expect(page.getByRole("button", { name: "Detener", exact: true })).toBeVisible();
  const menu = page.getByRole("button", { name: "Abrir menú", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.locator('a[href="/inventario"]:visible').first().click();
  await expect(page).toHaveURL(/\/inventario$/);
  await page.evaluate(() => (window as unknown as { cameraTest: { grant(): void } }).cameraTest.grant());
  await expect.poll(() => page.evaluate(() => (window as unknown as { cameraTest: { stopped: number } }).cameraTest.stopped)).toBe(1);
});

test("cámara: detener descarta una detección en vuelo", async ({ home: page }) => {
  await page.addInitScript(() => {
    const state = { stopped: 0, detecting: false, finish: (value: { rawValue: string }[]) => { void value; } };
    Object.assign(window, { cameraTest: state, BarcodeDetector: class { detect() { state.detecting = true; return new Promise(resolve => { state.finish = resolve; }); } } });
    HTMLMediaElement.prototype.play = async () => {};
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => {
      const stream = new MediaStream(); stream.getTracks = () => [{ stop: () => state.stopped++ } as unknown as MediaStreamTrack]; return stream;
    } });
  });
  await page.goto("/inventario/escanear");
  await page.getByRole("button", { name: "Activar cámara" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { cameraTest: { detecting: boolean } }).cameraTest.detecting)).toBe(true);
  await page.getByRole("button", { name: "Detener", exact: true }).click();
  await page.evaluate(async () => {
    (window as unknown as { cameraTest: { finish(value: { rawValue: string }[]): void } }).cameraTest.finish([{ rawValue: "K7QM" }]);
    await new Promise(requestAnimationFrame);
  });
  await expect(page).toHaveURL(/\/inventario\/escanear$/);
  await expect(page.getByRole("button", { name: "Activar cámara" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { cameraTest: { stopped: number } }).cameraTest.stopped)).toBe(1);
});
