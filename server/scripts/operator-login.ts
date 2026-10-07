import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const sessionFile = ".env.admin.session.json";
export function operatorCookie(origin: string): string {
  if (!existsSync(sessionFile)) throw new Error("Primero ejecutá npm run admin -- login.");
  const saved = JSON.parse(readFileSync(sessionFile, "utf8"));
  if (saved.origin !== origin || typeof saved.cookie !== "string" || saved.expiresAt <= Date.now()) throw new Error("Sesión vencida o de otro sitio. Ejecutá npm run admin -- login.");
  return saved.cookie;
}
export async function operatorLogin(origin: string) {
  const key = process.env.OPENDOMUS_OPERATOR_KEY;
  if (!key || !/^[a-f0-9]{64}$/.test(key)) throw new Error("Configurá OPENDOMUS_OPERATOR_KEY en .env.admin (archivo privado), o ingresá desde /admin.");
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  let code: string;
  try { code = (await terminal.question("Código actual del autenticador: ")).trim(); }
  finally { terminal.close(); }
  const response = await fetch(`${origin}/api/admin/auth/login`, { method: "POST", redirect: "error", headers: { Origin: origin, "X-OpenDomus-Operator": "browser", "Content-Type": "application/json" }, body: JSON.stringify({ key, code }) });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!response.ok || !cookie) throw new Error(`No se pudo ingresar (${response.status}). Usá un código nuevo o esperá si agotaste los intentos.`);
  writeFileSync(sessionFile, JSON.stringify({ origin, cookie, expiresAt: Date.now() + 3_600_000 }), { mode: 0o600 });
  console.log("Sesión de operador iniciada por una hora.");
}
export async function operatorLogout(origin: string) {
  const response = await fetch(`${origin}/api/admin/auth/logout`, { method: "POST", redirect: "error", headers: { Origin: origin, "X-OpenDomus-Operator": "browser", Cookie: operatorCookie(origin) } });
  if (!response.ok) throw new Error("No se pudo revocar la sesión.");
  unlinkSync(sessionFile);
  console.log("Sesión revocada.");
}
