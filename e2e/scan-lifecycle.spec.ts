import QRCode from "qrcode";
import { test, expect, addItem } from "./fixtures";

// El headless-shell devuelve NotSupportedError para getUserMedia; usar Chromium completo.
// CI no tiene cámara física. Chromium aporta un dispositivo virtual, pero mantiene
// su control real de permisos: no usar --use-fake-ui-for-media-stream.
test.use({ channel: "chromium", launchOptions: { args: ["--use-fake-device-for-media-stream"] } });

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


test("cámara: un permiso denegado conserva la entrada manual", async ({ home: page, context }) => {
  // Omitir cámara deniega ese permiso en Chromium, sin reemplazar getUserMedia.
  await context.grantPermissions([], { origin: "http://localhost:4173" });
  await page.goto("/inventario/escanear");
  expect(await page.evaluate(async () => (await navigator.permissions.query({ name: "camera" as PermissionName })).state)).toBe("denied");
  await page.getByRole("button", { name: "Activar cámara" }).click();
  await expect(page.getByText("No hay permiso para usar la cámara.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Activar cámara" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Detener", exact: true })).toHaveCount(0);
  expect(await page.locator("video").evaluate(video => (video as HTMLVideoElement).srcObject)).toBeNull();
  await page.getByPlaceholder("Ej. K7QM").fill("K7QM");
  await page.getByRole("button", { name: "Abrir", exact: true }).click();
  await expect(page).toHaveURL(/\/c\?code=K7QM$/);
  await expect(page.getByText("Este contenedor no está en este dispositivo", { exact: true })).toBeVisible();
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
  await expect(page.getByText("Este contenedor no está en este dispositivo", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("qrTestStopped"))).toBe("true");
});


test("cámara: cambiar de modo descarta permisos pendientes y conserva la búsqueda", async ({ home: page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.addInitScript(() => {
    const state = { stopped: 0, requests: 0, grant: () => {} };
    Object.assign(window, { cameraTest: state });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: () => new Promise<MediaStream>(resolve => {
      state.requests++;
      state.grant = () => { const stream = new MediaStream(); stream.getTracks = () => [{ stop: () => state.stopped++ } as unknown as MediaStreamTrack]; resolve(stream); };
    }) });
    Object.defineProperty(navigator, "xr", { value: undefined, configurable: true });
  });
  await page.goto("/inventario/camara");
  await page.getByRole("textbox", { name: "¿Qué buscás?" }).fill("arroz");
  await page.getByRole("button", { name: "Activar cámara" }).click();
  await expect(page.getByRole("button", { name: "Detener", exact: true })).toBeVisible();
  await page.getByRole("radiogroup", { name: "Modo de cámara" }).getByText("AR", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Entrar en AR" })).toBeDisabled();
  await expect(page.locator("video")).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { cameraTest: { grant(): void } }).cameraTest.grant());
  await expect.poll(() => page.evaluate(() => (window as unknown as { cameraTest: { stopped: number } }).cameraTest.stopped)).toBe(1);
  await page.getByRole("radiogroup", { name: "Modo de cámara" }).getByText("Mirar y encontrar", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "¿Qué buscás?" })).toHaveValue("arroz");
  await expect(page.getByRole("button", { name: "Activar cámara" })).toBeVisible();
  await expect(page.locator("video")).toHaveCount(1);
  expect(await page.evaluate(() => (window as unknown as { cameraTest: { requests: number } }).cameraTest.requests)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("radiogroup", { name: "Modo de cámara" }).getByText("Escanear QR", { exact: true }).click();
  await expect(page.getByPlaceholder("Ej. K7QM")).toBeVisible();
  await expect(page.locator("video")).toHaveCount(1);
});


test("cámara: encontrar muestra productos y notas; QR abre la ficha", async ({ home: page }, testInfo) => {
  if (testInfo.project.name === "celular") await page.setViewportSize({ width: 320, height: 780 });
  await addItem(page, "Alacena", "Arroz de prueba", 3, 1);
  const containerUrl = page.url();
  await page.getByRole("textbox", { name: "Contenido guardado" }).fill("Frasco azul");
  await page.getByRole("button", { name: "Anotar", exact: true }).click();
  await expect(page.getByText("Frasco azul", { exact: true })).toBeVisible();
  await page.goto("/inventario");
  await page.getByRole("button", { name: "Etiqueta: Alacena", exact: true }).click();
  const code = await page.locator(".od-label").locator("div").last().textContent();
  expect(code?.trim()).toMatch(/^[A-Z0-9]{4}$/);
  const qr = await QRCode.toDataURL(`https://localhost/c?code=${code?.trim()}`, { width: 320, margin: 4 });
  await page.addInitScript(dataUrl => {
    Object.defineProperty(window, "BarcodeDetector", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "xr", { value: undefined, configurable: true });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => {
      const image = new Image(); image.src = dataUrl; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 320;
      const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
      const stream = canvas.captureStream(10);
      const timer = setInterval(() => { if (stream.getVideoTracks()[0].readyState === "ended") clearInterval(timer); else context.drawImage(image, 0, 0); }, 100);
      return stream;
    } });
  }, qr);
  await page.goto("/inventario/camara");
  await page.getByRole("button", { name: "Activar cámara" }).click();
  await expect(page.getByRole("heading", { name: "Alacena", exact: true })).toBeVisible();
  await expect(page.getByText("Arroz de prueba", { exact: true })).toBeVisible();
  await expect(page.getByText("Frasco azul", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/inventario\/camara$/);
  await page.getByRole("textbox", { name: "¿Qué buscás?" }).fill("arroz");
  await expect(page.getByText("Frasco azul", { exact: true })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: testInfo.outputPath("encontrar.png"), fullPage: true, animations: "disabled" });
  await page.getByRole("radiogroup", { name: "Modo de cámara" }).getByText("AR", { exact: true }).click();
  await expect(page.getByText("Vista previa de la tarjeta", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar en AR" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: testInfo.outputPath("ar.png"), fullPage: true, animations: "disabled" });
  await page.getByRole("radiogroup", { name: "Modo de cámara" }).getByText("Escanear QR", { exact: true }).click();
  await page.getByRole("button", { name: "Activar cámara" }).click();
  await expect(page).toHaveURL(containerUrl);
  await expect(page.getByText("Frasco azul", { exact: true })).toBeVisible();
});


test("cámara: búsqueda manual y AR sin soporte en inglés", async ({ home: page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/ajustes");
  await page.getByText("English", { exact: true }).click();
  await page.addInitScript(() => Object.defineProperty(navigator, "xr", { value: undefined, configurable: true }));
  await page.goto("/inventario/camara");
  await page.getByRole("combobox", { name: "Container to display" }).fill("Alacena");
  await page.getByText("Cocina › Alacena", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Alacena", exact: true })).toBeVisible();
  await page.getByRole("radiogroup", { name: "Camera mode" }).getByText("AR", { exact: true }).click();
  await expect(page.getByText("Card preview", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter AR" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Open details" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: testInfo.outputPath("ar-en-dark.png"), fullPage: true, animations: "disabled" });
});
