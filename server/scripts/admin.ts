/**
 * Administración de la nube desde la terminal: licencias y planes de las casas.
 *
 *   npm run admin -- licencia nueva [--nota "Flor"] [--cantidad 1] [--dias 30] [--casas 1] [--plan beta]
 *   npm run admin -- licencias
 *   npm run admin -- revocar <id-de-licencia>
 *   npm run admin -- casas
 *   npm run admin -- pausar <id-de-casa>
 *   npm run admin -- reanudar <id-de-casa>
 *   npm run admin -- cuenta <email>
 *   npm run admin -- login
 *   npm run admin -- diagnostico
 *   npm run admin -- metricas
 *   npm run admin -- usuarios
 *   npm run admin -- feedback
 *   npm run admin -- avisos
 *
 * Necesita OPENDOMUS_API (gateway privado) y OPENDOMUS_ADMIN_TOKEN en el entorno o en
 * `.env.admin` (ignorado por git), además de cloudflared con una sesión Access OTP + MFA.
 * La cuenta doméstica no otorga permisos de operación. Ver README, administración privada.
 */
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { operatorDiagnostics, operatorOrigin } from "./operator-config.ts";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(".env.admin");
const API = (process.env.OPENDOMUS_API ?? "").replace(/\/$/, "");
const TOKEN = process.env.OPENDOMUS_ADMIN_TOKEN ?? "";

function flag(args: string[], name: string) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

async function call<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  const url = operatorOrigin(API);
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (!local && url.protocol !== "https:") throw new Error("La administración requiere HTTPS.");
  const access = local ? "" : process.env.OPENDOMUS_ACCESS_TOKEN ?? execFileSync("cloudflared", ["access", "token", "--app", API], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  const response = await fetch(`${API}/api/admin${path}`, {
    method,
    redirect: "error",
    headers: { Authorization: `Bearer ${TOKEN}`, ...(access ? { "Cf-Access-Token": access, "Cf-Access-Jwt-Assertion": access } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(`${response.status} ${data?.error ?? response.statusText}`);
  return data as T;
}

const date = (value: number | null | undefined) => (value ? new Date(value).toISOString().slice(0, 10) : "—");

async function main(args: string[]) {
  const [command, sub] = args;
  if (!command || command === "ayuda") {
    console.log(readFileSync(new URL(import.meta.url), "utf8").match(/\/\*\*([\s\S]*?)\*\//)![1].replace(/^ \* ?/gm, "").trim());
    return;
  }
  if (command === "diagnostico") {
    let available = false;
    try {
      execFileSync("cloudflared", ["--version"], { stdio: "ignore", timeout: 5000, windowsHide: true });
      available = true;
    } catch { /* Ausente o no ejecutable: se informa sin mostrar salida del proceso. */ }
    console.log(operatorDiagnostics(process.env, available).join("\n"));
    return;
  }
  if (!API) throw new Error("Falta OPENDOMUS_API: usá el Worker administrativo protegido por Access.");
  operatorOrigin(API);
  if (command === "login") {
    if (new URL(API).protocol !== "https:") throw new Error("El login requiere HTTPS.");
    execFileSync("cloudflared", ["access", "login", API], { stdio: "inherit" });
    return;
  }
  if (!TOKEN) throw new Error("Falta OPENDOMUS_ADMIN_TOKEN (en el entorno o en .env.admin).");
  const reports: Record<string, string> = { metricas: "overview", usuarios: "users", feedback: "feedback", avisos: "notices" };
  if (Object.hasOwn(reports, command)) {
    console.log(JSON.stringify(await call("GET", `/platform/${reports[command]}`), null, 2));
    return;
  }
  if (command === "resolver-feedback" && sub) {
    await call("PATCH", `/platform/feedback/${encodeURIComponent(sub)}`, { status: "resolved" });
    console.log("Feedback resuelto.");
    return;
  }

  if (command === "cuenta" && sub) {
    const { accounts } = await call<{ accounts: Record<string, unknown>[] }>("GET", `/accounts?email=${encodeURIComponent(sub)}`);
    console.table(accounts);
    return;
  }
  if (command === "licencia" && sub === "nueva") {
    const { licenses } = await call<{ licenses: { id: string; code: string; plan: string; expiresAt: number | null }[] }>("POST", "/platform/licenses", {
      count: Number(flag(args, "cantidad") ?? 1),
      maxHouseholds: Number(flag(args, "casas") ?? 1),
      plan: flag(args, "plan") ?? "beta",
      expiresInDays: flag(args, "dias") ? Number(flag(args, "dias")) : undefined,
      note: flag(args, "nota"),
    });
    console.log("Códigos (se muestran una sola vez; pasalos por un canal privado):\n");
    for (const license of licenses) console.log(`  ${license.code}   plan ${license.plan} · vence ${date(license.expiresAt)} · id ${license.id}`);
    return;
  }
  if (command === "licencias") {
    const { licenses } = await call<{ licenses: Record<string, unknown>[] }>("GET", "/platform/licenses");
    console.table(licenses.map((license) => ({ ...license, expiresAt: date(license.expiresAt as number), createdAt: date(license.createdAt as number) })));
    return;
  }
  if (command === "revocar" && sub) {
    await call("POST", `/platform/licenses/${sub}/revoke`);
    console.log("Licencia revocada.");
    return;
  }
  if (command === "casas") {
    const { households } = await call<{ households: Record<string, unknown>[] }>("GET", "/platform/households");
    console.table(households.map((household) => ({ ...household, createdAt: date(household.createdAt as number), periodEnd: date(household.periodEnd as number) })));
    return;
  }
  if ((command === "pausar" || command === "reanudar") && sub) {
    await call("POST", `/platform/households/${sub}/${command === "pausar" ? "pause" : "resume"}`);
    console.log(command === "pausar" ? "Casa en pausa: se puede bajar todo, no subir." : "Casa activa de nuevo.");
    return;
  }
  console.log(readFileSync(new URL(import.meta.url), "utf8").match(/\/\*\*([\s\S]*?)\*\//)![1].replace(/^ \* ?/gm, "").trim());
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
