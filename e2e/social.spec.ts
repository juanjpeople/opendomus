import { expect, test } from "@playwright/test";

test("el retorno con email pendiente explica el reintento sin hacerlo automáticamente", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", (request) => { if (request.method() === "POST") writes.push(request.url()); });
  await page.route("**/api/social-providers", (route) => route.fulfill({ json: { providers: ["github"] } }));
  await page.goto("/cuenta?modo=entrar&socialError=1&error=email_not_verified");
  await expect(page.getByText("El proveedor no pudo completar la verificación", { exact: false })).toBeVisible();
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
  await expect(page.getByText("No pudimos consultar o abrir los proveedores.", { exact: false })).toBeVisible();
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
  await expect(page.getByText("No pudimos abrir tus claves.", { exact: false })).toBeVisible();
  expect(writes).toEqual([]);
});

test("sin proveedores configurados se conserva el acceso por contraseña", async ({ page }) => {
  await page.route("**/api/social-providers", (route) => route.fulfill({ json: { providers: [] } }));
  await page.goto("/cuenta?modo=entrar");
  await expect(page.getByRole("button", { name: "Continuar con Google" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continuar con GitHub" })).toHaveCount(0);
  await expect(page.getByLabel("Contraseña", { exact: true })).toBeVisible();
});
