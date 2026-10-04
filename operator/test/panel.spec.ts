import { expect, test } from "@playwright/test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:https";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { createOperatorGateway } from "../../server/src/operator-gateway";
import { verifyOperatorToken } from "../../server/src/operator-access";

// Real browser + gateway + signed test identity; backend data is synthetic.
// No network, production credentials or authentication bypass in the deployed Worker.
test("panel privado: rechazo, datos, licencia y revocación de identidad", async ({ page }, testInfo) => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const keys = createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: "test", alg: "RS256" }] });
  const config = { OPERATOR_HOST: "127.0.0.1", OPERATOR_ACCESS_ISSUER: "https://example.cloudflareaccess.com", OPERATOR_ACCESS_AUD: "private-panel", OPERATOR_EMAILS: "owner@example.com", OPERATOR_BROWSER_TOKEN: "server-only-synthetic-secret-1234567890" };
  const jwt = await new SignJWT({ email: "owner@example.com" }).setProtectedHeader({ alg: "RS256", kid: "test" }).setSubject("operator").setIssuer(config.OPERATOR_ACCESS_ISSUER).setAudience(config.OPERATOR_ACCESS_AUD).setIssuedAt().setExpirationTime("5m").sign(privateKey);
  let authorized = false;
  let writes = 0;
  let unavailable = false;
  const gateway = createOperatorGateway((token, env) => verifyOperatorToken(token, env, keys));
  const env = { ...config,
    OPERATOR_ASSETS: { fetch: async (request: Request) => {
      const script = new URL(request.url).pathname === "/panel.js";
      return new Response(await readFile(script ? "operator-dist/panel.js" : "operator-dist/index.html", "utf8"), { headers: { "Content-Type": script ? "application/javascript" : "text/html" } });
    } },
    OPENDOMUS: { fetch: async (request: Request) => {
      expect(request.headers.get("Authorization")).toBe(`Bearer ${config.OPERATOR_BROWSER_TOKEN}`);
      expect(request.headers.get("cookie")).toBeNull();
      if (unavailable) return Response.json({ error: "unavailable" }, { status: 503 });
      const key = new URL(request.url).pathname.split("/").at(-1)!;
      if (request.method === "POST") {
        expect(key).toBe("licenses");
        expect(await request.json()).toMatchObject({ count: 1 });
        writes++;
        return Response.json({ licenses: [{ code: "OD-SYNTHETIC-LICENSE" }] });
      }
      if (key === "overview") return Response.json({ metrics: { users: 2, households: 1, activeHouseholds: 1, pausedHouseholds: 0, activeSessions: 2, licenses: 1, availableLicenses: 1, openFeedback: 0, pendingNotices: 0 }, risks: [], credentials: { adminTokenConfigured: true, supabaseConfigured: false }, recentAudit: [] });
      return Response.json({ [key]: key === "users" ? [{ id: "synthetic", name: "Persona de prueba", email: "synthetic@example.com", households: 1, activeSessions: 1, lastSessionAt: null }] : [] });
    } },
  };
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
      if (authorized) headers.set("Cf-Access-Jwt-Assertion", jwt);
      const request = new Request(`https://${incoming.headers.host}${incoming.url}`, { method: incoming.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
      const response = await gateway.fetch(request, env);
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
  for (const path of ["/admin", "/panel.js"]) {
    expect((await gateway.fetch(new Request(`${base}${path}`), env)).status).toBe(404);
  }
  authorized = true;
  await page.goto(`${base}/admin`);
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
  env.OPERATOR_EMAILS = "other@example.com"; // El JWT sigue firmado y vigente: se retiró el permiso.
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.getByText("Sesión privada vencida o acceso no autorizado")).toBeVisible();
  await expect(page.getByText("synthetic@example.com")).toHaveCount(0);
  await expect(page.getByText("OD-SYNTHETIC-LICENSE")).toHaveCount(0);
  expect(errors).toEqual([]);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (dirname(resolve(certDir)) !== resolve(tmpdir()) || !basename(certDir).startsWith("opendomus-operator-test-")) throw new Error("Unexpected test certificate directory");
    await rm(certDir, { recursive: true });
  }
});
