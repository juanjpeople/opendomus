/**
 * Administración de la nube desde la terminal: licencias y planes de las casas.
 *
 *   npm run admin -- licencia nueva [--nota "Flor"] [--cantidad 1] [--dias 30] [--casas 1] [--plan beta]
 *   npm run admin -- licencias
 *   npm run admin -- revocar <id-de-licencia>
 *   npm run admin -- casas
 *   npm run admin -- pausar <id-de-casa>
 *   npm run admin -- reanudar <id-de-casa>
 *
 * Necesita OPENDOMUS_ADMIN_TOKEN (y OPENDOMUS_API si no es producción), en el entorno o en un
 * archivo `.env.admin` en la raíz del repo (ignorado por git: el token nunca va al repo).
 */
import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(".env.admin");
const API = (process.env.OPENDOMUS_API ?? "https://opendomus.juanjpeople.workers.dev").replace(/\/$/, "");
const TOKEN = process.env.OPENDOMUS_ADMIN_TOKEN ?? "";

function flag(args: string[], name: string) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API}/api/admin${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(`${response.status} ${data?.error ?? response.statusText}`);
  return data as T;
}

const date = (value: number | null | undefined) => (value ? new Date(value).toISOString().slice(0, 10) : "—");

async function main(args: string[]) {
  if (!TOKEN) throw new Error("Falta OPENDOMUS_ADMIN_TOKEN (en el entorno o en .env.admin).");
  const [command, sub] = args;

  if (command === "licencia" && sub === "nueva") {
    const { licenses } = await call<{ licenses: { id: string; code: string; plan: string; expiresAt: number | null }[] }>("POST", "/licenses", {
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
    const { licenses } = await call<{ licenses: Record<string, unknown>[] }>("GET", "/licenses");
    console.table(licenses.map((license) => ({ ...license, expiresAt: date(license.expiresAt as number), createdAt: date(license.createdAt as number) })));
    return;
  }
  if (command === "revocar" && sub) {
    await call("POST", `/licenses/${sub}/revoke`);
    console.log("Licencia revocada.");
    return;
  }
  if (command === "casas") {
    const { households } = await call<{ households: Record<string, unknown>[] }>("GET", "/households");
    console.table(households.map((household) => ({ ...household, createdAt: date(household.createdAt as number), periodEnd: date(household.periodEnd as number) })));
    return;
  }
  if ((command === "pausar" || command === "reanudar") && sub) {
    await call("POST", `/households/${sub}/${command === "pausar" ? "pause" : "resume"}`);
    console.log(command === "pausar" ? "Casa en pausa: se puede bajar todo, no subir." : "Casa activa de nuevo.");
    return;
  }
  console.log(readFileSync(new URL(import.meta.url), "utf8").match(/\/\*\*([\s\S]*?)\*\//)![1].replace(/^ \* ?/gm, "").trim());
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
