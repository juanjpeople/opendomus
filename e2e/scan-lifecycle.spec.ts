import QRCode from "qrcode";
import { test, expect } from "./fixtures";

test("cámara: libera un permiso que llega después de salir de la pantalla", async ({ home: page }) => {
  await page.addInitScript(() => {
    const state = { stopped: 0, grant: () => {} };
    Object.assign(window, { cameraTest: state });
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

test("cámara: detener descarta un inicio de video pendiente", async ({ home: page }) => {
  await page.addInitScript(() => {
    const state = { stopped: 0, detecting: false, finish: () => {} };
    Object.assign(window, { cameraTest: state });
    HTMLMediaElement.prototype.play = () => { state.detecting = true; return new Promise<void>(resolve => { state.finish = resolve; }); };
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => {
      const stream = new MediaStream(); stream.getTracks = () => [{ stop: () => state.stopped++ } as unknown as MediaStreamTrack]; return stream;
    } });
  });
  await page.goto("/inventario/escanear");
  await page.getByRole("button", { name: "Activar cámara" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { cameraTest: { detecting: boolean } }).cameraTest.detecting)).toBe(true);
  await page.getByRole("button", { name: "Detener", exact: true }).click();
  await page.evaluate(async () => {
    (window as unknown as { cameraTest: { finish(): void } }).cameraTest.finish();
    await new Promise(requestAnimationFrame);
  });
  await expect(page).toHaveURL(/\/inventario\/escanear$/);
  await expect(page.getByRole("button", { name: "Activar cámara" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { cameraTest: { stopped: number } }).cameraTest.stopped)).toBe(1);
});


test("QR: primera lectura sin conexión ni BarcodeDetector libera su stream", async ({ home: page, context }) => {
  const qr = await QRCode.toDataURL("https://localhost/c?code=K7QM", { width: 320, margin: 4 });
  await page.addInitScript(dataUrl => {
    Object.defineProperty(window, "BarcodeDetector", { value: undefined, configurable: true });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => {
      const image = new Image(); image.src = dataUrl; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 320;
      const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
      const stream = canvas.captureStream(10);
      sessionStorage.removeItem("qrTestStopped");
      for (const track of stream.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => { stop(); sessionStorage.setItem("qrTestStopped", String(stream.getTracks().every(item => item.readyState === "ended"))); };
      }
      const timer = setInterval(() => { if (stream.getVideoTracks()[0].readyState === "ended") clearInterval(timer); else context.drawImage(image, 0, 0); }, 100);
      return stream;
    } });
  }, qr);
  // La instalación termina cuando el worker activa todo el precache. El lector
  // todavía no se visitó ni se activó: su código debe estar disponible igual.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.goto("/inventario/escanear");
  await page.getByRole("button", { name: "Activar cámara" }).click();
  await expect(page).toHaveURL(/\/c\?code=K7QM$/);
  expect(await page.evaluate(() => sessionStorage.getItem("qrTestStopped"))).toBe("true");
});
