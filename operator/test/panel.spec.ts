import { expect, test } from "@playwright/test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:https";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { operatorFixture, TEST_KEY, TEST_TOTP } from "../../server/test/operator-fixture";
import { operatorTotp } from "../../server/src/operator-auth";
import { operatorPage } from "../../server/src/operator-page";

// Navegador real + clave/TOTP + sesión SQLite; datos del panel sintéticos.
// No network, production credentials or authentication bypass in the deployed Worker.
test("panel privado: rechazo, datos, licencia y revocación de identidad", async ({ page }, testInfo) => {
  const { app, env, database } = await operatorFixture();
  let writes = 0;
  let unavailable = false;
  app.all("/api/admin/platform/*", async c => {
      const request = c.req.raw;
      if (unavailable) return c.json({ error: "unavailable" }, 503);
      const key = new URL(request.url).pathname.split("/").at(-1)!;
      if (request.method === "POST") {
        expect(key).toBe("licenses");
        expect(await request.json()).toMatchObject({ count: 1 });
        writes++;
        return c.json({ licenses: [{ code: "OD-SYNTHETIC-LICENSE" }] });
      }
      if (key === "overview") return c.json({ metrics: { users: 2, households: 1, activeHouseholds: 1, pausedHouseholds: 0, activeSessions: 2, licenses: 1, availableLicenses: 1, openFeedback: 0, pendingNotices: 0 }, risks: [], credentials: { operatorConfigured: true, supabaseConfigured: false }, recentAudit: [] });
      return c.json({ [key]: key === "users" ? [{ id: "synthetic", name: "Persona de prueba", email: "synthetic@example.com", households: 1, activeSessions: 1, lastSessionAt: null }] : [] });
  });
  const assets = { fetch: async (request: Request) => {
    const script = new URL(request.url).pathname === "/admin/panel.js";
    return new Response(await readFile(script ? "operator-dist/panel.js" : "operator-dist/index.html", "utf8"), { headers: { "Content-Type": script ? "application/javascript" : "text/html" } });
  } };
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const certDir = await mkdtemp(join(tmpdir(), "opendomus-operator-test-"));
  const keyPath = join(certDir, "key.pem"), certPath = join(certDir, "cert.pem");
  execFileSync(process.env.OPENSSL_BINARY ?? (process.platform === "win32" ? "C:/Program Files/Git/usr/bin/openssl.exe" : "openssl"), ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyPath, "-out", certPath, "-days", "1", "-subj", "/CN=localhost"], { stdio: "ignore", windowsHide: true });
  const server = createServer({ key: await readFile(keyPath), cert: await readFile(certPath) }, async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(",") : value);
      const request = new Request(`https://${incoming.headers.host}${incoming.url}`, { method: incoming.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
      const response = incoming.url?.startsWith("/admin") ? await operatorPage(request, assets) : await app.fetch(request, env);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      errors.push(String(error));
      outgoing.writeHead(500).end();
    }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
  env.APP_ORIGIN = base;
  await page.goto(base + "/admin");
  await expect(page.getByRole("heading", { name: "Acceso de operador" })).toBeVisible();
  await expect(page.getByText("Estado de la plataforma", { exact: true })).toHaveCount(0);
  await page.getByLabel("Clave de operador").fill(TEST_KEY);
  await page.getByLabel("Código del autenticador").fill(await operatorTotp(TEST_TOTP, Math.floor(Date.now() / 30000)));
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByText("Estado de la plataforma", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Usuarios", exact: true }).click();
  await expect(page.getByText("synthetic@example.com")).toBeVisible();
  await page.getByRole("tab", { name: "Licencias", exact: true }).click();
  await page.getByRole("button", { name: "Generar licencias", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Generar licencias", exact: true }).click();
  await expect(page.getByText("OD-SYNTHETIC-LICENSE", { exact: true })).toBeVisible();
  expect(writes).toBe(1);
  await page.screenshot({ path: testInfo.outputPath("private-license.png") });
  const refreshed = page.waitForResponse(response => response.url().endsWith("/platform/notices") && response.status() === 200);
  await page.getByRole("button", { name: "Aceptar", exact: true }).click();
  await refreshed;
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Actualizar", exact: true })).not.toHaveClass(/ant-btn-loading/);
  unavailable = true;
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.getByText("No se pudo completar la consulta u operación")).toBeVisible();
  await expect(page.getByText("Estado de la plataforma", { exact: true })).toHaveCount(0);
  unavailable = false;
  await page.getByRole("button", { name: "Volver a consultar", exact: true }).click();
  await expect(page.getByText("Estado de la plataforma", { exact: true })).toBeVisible();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(page.getByText("Estado de la plataforma", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("private-panel-dark.png"), fullPage: true });
  env.OPERATOR_EMAIL = "other@example.com"; // La sesión existe pero se retiró el permiso.
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.getByText("Sesión privada vencida o acceso no autorizado")).toBeVisible();
  await expect(page.getByText("synthetic@example.com")).toHaveCount(0);
  await expect(page.getByText("OD-SYNTHETIC-LICENSE")).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar sesión privada" }).click();
  await expect(page.getByRole("heading", { name: "Acceso de operador" })).toBeVisible();
  expect(errors).toEqual([]);
  } finally {
    database.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (dirname(resolve(certDir)) !== resolve(tmpdir()) || !basename(certDir).startsWith("opendomus-operator-test-")) throw new Error("Unexpected test certificate directory");
    await rm(certDir, { recursive: true });
  }
});
