import { expect, test, type BrowserContext } from "@playwright/test";
import type { StoredOp, WireOp } from "../src/lib/sync/protocol";

/** Mock only the transport: account keys, encryption, IndexedDB and sync run in the real app. */
test("la precarga se elige antes del alta cloud y llega cifrada a un segundo dispositivo", async ({ page, browser }) => {
  const user = { id: "setup-test-user", name: "Prueba", email: "setup@example.test" };
  let signedIn = false;
  let keys: Record<string, unknown> | null = null;
  let household: Record<string, unknown> | null = null;
  const operations: StoredOp[] = [];
  const unexpected: string[] = [];
  const links: Record<string, unknown>[] = [];
  async function mockApi(context: BrowserContext) {
    await context.route("**/api/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.slice(4);
      let result: unknown = {};
      if (path === "/licenses/check") result = { valid: true };
      else if (path.startsWith("/auth/sign-")) signedIn = true;
      else if (path === "/keys") keys = request.postDataJSON();
      else if (path === "/me") result = { user: signedIn ? user : null, keys, households: household ? [household] : [] };
      else if (path === "/households" && request.method() === "POST") {
        household = { ...request.postDataJSON(), role: "admin", familyKeyVersion: 1, adultsKeyVersion: 1, plan: "beta", planStatus: "active" };
      } else if (path.endsWith("/ops")) {
        if (request.method() === "POST") {
          const incoming = request.postDataJSON().ops as WireOp[];
          for (const operation of incoming) if (!operations.some((entry) => entry.id === operation.id)) operations.push({ ...operation, seq: operations.length + 1, author: user.id });
          result = { acks: incoming.map((entry) => ({ id: entry.id, seq: operations.find((op) => op.id === entry.id)!.seq })) };
        } else result = { ops: operations.filter((op) => op.seq > Number(url.searchParams.get("since") ?? 0)), next: operations.length, head: operations.length };
      } else if (path.endsWith("/members")) result = { members: [{ ...user, userId: user.id, role: "admin", signPublicKey: keys?.signPublicKey }], former: [] };
      else if (path === "/social-providers") result = { providers: ["google", "github"] };
      else if (path === "/auth/list-accounts") result = [{ providerId: "github" }];
      else if (path === "/account/devices") result = { devices: [] };
      else if (path.endsWith("/invites")) result = { invites: [] };
      else if (path === "/auth/link-social") { links.push(request.postDataJSON()); result = { url: "https://unexpected.example/blocked" }; }
      else { unexpected.push(`${request.method()} ${path}`); return route.fulfill({ status: 404, json: { error: "not-found" } }); }
      await route.fulfill({ json: result });
    });
  }
  await mockApi(page.context());
  await page.goto("/cuenta?modo=crear&siguiente=casa");
  const panel = page.getByRole("main").locator(".ant-card").first();
  await expect(panel).toBeVisible();
  const initialWidth = await panel.evaluate((element) => element.getBoundingClientRect().width);
  await page.getByPlaceholder("OD-XXXX-XXXX-XXXX-XXXX").fill("OD-TEST-TEST-TEST-TEST");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Tu nombre", { exact: true }).fill(user.name);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Contraseña", { exact: true }).fill("Synthetic test password 123!");
  await page.getByLabel("Repetí la contraseña", { exact: true }).fill("Synthetic test password 123!");
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByRole("checkbox", { name: "Guardé mi kit en un lugar seguro" }).check();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "¿Cómo querés empezar tu casa?" })).toBeVisible();
  expect(await panel.evaluate((element) => element.getBoundingClientRect().width)).toBeCloseTo(initialWidth, 0);
  expect(household).toBeNull();
  await page.getByRole("checkbox", { name: "Cocina", exact: true }).check();
  await page.getByRole("checkbox", { name: "Heladera", exact: true }).check();
  await page.getByRole("radio", { name: "Queda poco · fin de mes" }).check();
  await page.getByRole("checkbox", { name: "Activar escuela: materias, mochila y tareas" }).check();
  await page.getByRole("button", { name: "Guardar esta selección" }).click();
  await page.getByLabel("Nombre de la casa", { exact: true }).fill("Casa de prueba");
  await page.getByRole("button", { name: "Crear mi casa", exact: true }).click();
  await expect.poll(() => operations.length).toBeGreaterThan(0);
  expect(JSON.stringify(operations)).not.toContain("Huevos");
  await expect(page.getByRole("button", { name: "Invitar a mi familia", exact: true })).toBeVisible();

  const second = await browser.newContext({ locale: "es-AR" });
  try {
    await mockApi(second);
    const other = await second.newPage();
    await other.goto(new URL("/cuenta?modo=entrar", page.url()).href);
    await other.getByLabel("Email", { exact: true }).fill(user.email);
    await other.getByLabel("Contraseña", { exact: true }).fill("Synthetic test password 123!");
    await other.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(other.getByRole("button", { name: "Ir a mi casa", exact: true })).toBeVisible();
    await other.goto(new URL("/", page.url()).href);
    await expect(other.getByText("Escuela hoy · mochila y tareas", { exact: true })).toBeVisible();
    await other.goto(new URL("/inventario", page.url()).href);
    await other.getByText("Heladera", { exact: true }).first().click();
    await expect(other.getByRole("button", { name: "Ver detalle de Huevos", exact: true })).toBeVisible();
    await expect(other.getByRole("button", { name: "Ver detalle de Leche", exact: true })).toBeVisible();
    await expect(other.getByText("Taller de herramientas", { exact: true })).toHaveCount(0);
  } finally { await second.close(); }
  await page.goto("/ajustes");
  const providers = page.getByRole("group", { name: "Acceso con proveedores", exact: true });
  await expect(providers.getByRole("button", { name: "GitHub vinculado", exact: true })).toBeDisabled();
  await providers.getByRole("button", { name: "Vincular Google", exact: true }).click();
  await expect(providers.getByRole("alert")).toContainText("No pudimos abrir los proveedores; podés entrar con tu contraseña.");
  expect(links).toHaveLength(1);
  expect(links[0]).toMatchObject({ provider: "google", disableRedirect: true });
  expect(links[0].callbackURL).toMatch(/\/ajustes$/);
  expect(links[0].password).toBeUndefined();
  expect(unexpected).toEqual([]);
});
