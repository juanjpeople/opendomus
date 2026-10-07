import { expect, test } from "@playwright/test";

test("el retorno con email pendiente explica el reintento sin hacerlo automáticamente", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", (request) => { if (request.method() === "POST") writes.push(request.url()); });
  await page.route("**/api/social-providers", (route) => route.fulfill({ json: { providers: ["github"] } }));
  await page.goto("/cuenta?modo=entrar&socialError=1&error=email_not_verified");
  await expect(page.getByText("Revisá que tu correo esté verificado", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar con GitHub" })).toBeVisible();
  expect(writes).toEqual([]);
});

test("proveedores habilitados y rechazo de un destino OAuth inesperado", async ({ page }) => {
  await page.route("**/api/social-providers", (route) => route.fulfill({ json: { providers: ["google", "github"] } }));
  await page.route("**/api/auth/sign-in/social", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.provider).toBe("google");
    expect(body.disableRedirect).toBe(true);
    expect(body.callbackURL).toMatch(/\/cuenta\?modo=entrar&social=1$/);
    expect(body.password).toBeUndefined();
    await route.fulfill({ json: { url: "https://unexpected.example/steal" } });
  });
  await page.goto("/cuenta?modo=entrar");
  await expect(page.getByRole("button", { name: "Continuar con GitHub" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar con Google" }).click();
  await expect(page.getByText("No pudimos abrir los proveedores; podés entrar con tu contraseña.", { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/cuenta\?modo=entrar$/);
});

test("retorno social sin sesión no entra ni envía la contraseña", async ({ page }) => {
  const writes: string[] = [];
  await page.route("**/api/**", async (route) => {
    if (route.request().method() !== "GET") writes.push(route.request().url());
    await route.fulfill({ json: { user: null } });
  });
  await page.goto("/cuenta?modo=entrar&social=1");
  await expect(page.getByText("Abrí tus datos cifrados", { exact: true })).toBeVisible();
  await page.getByLabel("Contraseña", { exact: true }).fill("solo-en-este-dispositivo");
  await page.getByRole("button", { name: "Desbloquear datos" }).click();
  await expect(page.getByText("Revisá tu contraseña, volvé a ingresar si venció la sesión o usá tu kit de recuperación.", { exact: false })).toBeVisible();
  expect(writes).toEqual([]);
});

test("sin proveedores configurados se conserva el acceso por contraseña", async ({ page }) => {
  await page.route("**/api/social-providers", (route) => route.fulfill({ json: { providers: [] } }));
  await page.goto("/cuenta?modo=entrar");
  await expect(page.getByRole("button", { name: "Continuar con Google" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continuar con GitHub" })).toHaveCount(0);
  await expect(page.getByLabel("Contraseña", { exact: true })).toBeVisible();
});


test("proveedores: muestran espera, conservan contraseña y caben en 320 px", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 780 });
  let finish: (() => void) | undefined;
  let requests = 0;
  await page.route("**/api/social-providers", route => route.fulfill({ json: { providers: ["google", "github"] } }));
  await page.route("**/api/auth/sign-in/social", async route => {
    requests++;
    await new Promise<void>(resolve => { finish = resolve; });
    await route.fulfill({ status: 500, json: { error: "unknown" } });
  });
  await page.goto("/cuenta?modo=entrar");
  const google = page.getByRole("button", { name: "Continuar con Google", exact: true });
  const github = page.getByRole("button", { name: "Continuar con GitHub", exact: true });
  await expect(google.locator("svg")).toHaveAttribute("aria-hidden", "true");
  await expect(github.locator("svg")).toHaveAttribute("aria-hidden", "true");
  await google.click();
  await expect.poll(() => requests).toBe(1);
  await expect(google).toBeDisabled();
  await expect(github).toBeDisabled();
  await expect(page.getByLabel("Contraseña", { exact: true })).toBeEnabled();
  finish!();
  await expect(google).toBeEnabled();
  await expect(page.getByRole("alert").filter({ hasText: "No pudimos abrir los proveedores; podés entrar con tu contraseña." })).toBeVisible();
  await page.getByText("EN", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Continue with Google", exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: testInfo.outputPath("social-en.png"), fullPage: true, animations: "disabled" });
});
