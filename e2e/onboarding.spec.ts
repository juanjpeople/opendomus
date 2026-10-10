import { expect, test } from "@playwright/test";

test("cuenta accesible sin invitación desde bienvenida y empezar", async ({ page }, testInfo) => {
  for (const route of ["/bienvenida", "/empezar"]) {
    await page.goto(route);
    await expect(page.getByRole("link", { name: "Ya tengo cuenta", exact: true })).toHaveAttribute("href", "/cuenta?modo=entrar");
    await expect(page.getByRole("link", { name: "Tengo una invitación", exact: true })).toHaveAttribute("href", "/unirme");
    await page.getByRole("link", { name: "Crear cuenta", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Creá tu cuenta" })).toBeVisible();
    // Quien fue invitado se registra desde el link, no acá.
    await expect(page.getByRole("link", { name: "Abrir una invitación" })).toHaveAttribute("href", "/unirme");
    await expect(page.getByRole("heading", { name: "Código de acceso" })).toHaveCount(0);
    await page.goBack();
    await page.locator('a[href*="modo=recuperar"]').click();
    await expect(page.locator('textarea[placeholder="ODK1-XXXX-XXXX-…"]')).toBeVisible();
  }
  await page.goto("/empezar");
  await expect(page.getByRole("link", { name: "Crear cuenta", exact: true })).toBeVisible();
  // La captura también debe incluir las tarjetas tras su animación de entrada.
  await expect(page.getByRole("heading", { name: "Crear mi casa", exact: true }).locator("../../..")).toHaveCSS("opacity", "1");
  await page.getByRole("link", { name: "Nuestros valores" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("link", { name: "Nuestros valores" }).locator("../../..")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: testInfo.outputPath("cuenta-claro.png"), fullPage: true });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.screenshot({ path: testInfo.outputPath("cuenta-oscuro.png"), fullPage: true });
});

test("la portada muestra los tres accesos: empezar, invitación y cuenta", async ({ page }) => {
  await page.goto("/bienvenida");
  await expect(page.getByRole("link", { name: "¿Te invitaron? Abrí tu invitación" })).toHaveAttribute("href", "/unirme");
  await expect(page.getByRole("link", { name: "¿Ya tenés cuenta? Entrar" })).toHaveAttribute("href", "/cuenta?modo=entrar");
});

test("la primera vez arranca por la landing y la bienvenida; después, directo a la casa", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/bienvenida/);

  await expect(page.getByRole("heading", { name: "Tus datos hacen este recorrido. Ninguno más." })).toBeAttached();
  await expect(page.getByText("Los controles automáticos reducen riesgos")).toBeAttached();
  await expect(page.getByRole("link", { name: "Cómo reportar" })).toHaveAttribute("href", "https://github.com/juanjpeople/opendomus/security");

  await page.getByRole("link", { name: "Empezar" }).first().click();
  await expect(page).toHaveURL(/empezar/);
  // En el dispositivo es gratis; la nube es opcional y está en beta por invitación (pide un código).
  await expect(page.getByText("Gratis", { exact: true })).toBeVisible();
  await expect(page.getByText("Beta · por invitación")).toBeVisible();
  await page.getByRole("button", { name: "Crear mi casa" }).click();
  await expect(page).toHaveURL(/cuenta/);
  await expect(page.getByRole("heading", { name: "Código de acceso" })).toBeVisible();
  await page.goBack();

  await page.getByRole("button", { name: "Empezar acá" }).click();
  await page.getByRole("button", { name: "Empezar sin precarga" }).click();
  await expect(page.getByText("¿Quién está en casa?")).toBeVisible();
  await expect(page.getByText("Este dispositivo")).toBeVisible();
  await page.getByText("Administrador", { exact: true }).first().click();

  await page.goto("/");
  await expect(page).not.toHaveURL(/bienvenida/);
  await page.goto("/bienvenida");
  await expect(page.getByRole("link", { name: "Ir a mi casa" }).first()).toBeVisible();
});
