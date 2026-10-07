import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "./env";

export interface OperatorConfig {
  APP_ORIGIN: string;
  OPERATOR_EMAIL?: string;
  OPERATOR_KEY_HASH?: string;
  OPERATOR_TOTP_SECRET?: string;
}
const COOKIE = "__Host-od-operator";
const LOCAL_COOKIE = "od-operator-local";
const HOUR = 3_600_000;

export function operatorConfigured(env: OperatorConfig): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.OPERATOR_EMAIL ?? "") &&
    /^[a-f0-9]{64}$/.test(env.OPERATOR_KEY_HASH ?? "") && /^[A-Z2-7]{32}$/.test(env.OPERATOR_TOTP_SECRET ?? "");
}
export async function operatorHash(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function equal(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}
/** RFC 6238, SHA-1, período 30 s. El secreto aleatorio tiene 160 bits (base32). */
export async function operatorTotp(secret: string, step: number, digits = 6): Promise<string> {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  if (!/^[A-Z2-7]{32}$/.test(secret)) throw new Error("Invalid TOTP configuration");
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const character of secret) {
    value = (value << 5) | alphabet.indexOf(character); bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((value >>> bits) & 255); }
  }
  const counter = new ArrayBuffer(8);
  new DataView(counter).setBigUint64(0, BigInt(step));
  const key = await crypto.subtle.importKey("raw", new Uint8Array(bytes), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, counter));
  const offset = mac[mac.length - 1] & 15;
  const number = new DataView(mac.buffer).getUint32(offset) & 0x7fffffff;
  return String(number % (10 ** digits)).padStart(digits, "0");
}
async function configurationHash(env: OperatorConfig) {
  return operatorHash(JSON.stringify([env.APP_ORIGIN, env.OPERATOR_EMAIL, env.OPERATOR_KEY_HASH, env.OPERATOR_TOTP_SECRET]));
}
export function operatorOriginAllowed(request: Request, env: OperatorConfig): boolean {
  const url = new URL(request.url);
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  return (url.protocol === "https:" || local) && url.origin === env.APP_ORIGIN;
}
function cookieName(request: Request) { return new URL(request.url).protocol === "https:" ? COOKIE : LOCAL_COOKIE; }
function cookie(request: Request, token: string, maxAge: number) {
  return `${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
function sessionToken(request: Request): string | null {
  const value = request.headers.get("Cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName(request)}=`))?.split("=")[1];
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export async function operatorSession(request: Request, env: AppEnv["Bindings"]): Promise<string | null> {
  if (!operatorConfigured(env) || !operatorOriginAllowed(request, env)) return null;
  const token = sessionToken(request);
  if (!token) return null;
  const row = await env.DB.prepare("SELECT token_hash FROM operator_sessions WHERE token_hash = ? AND config_hash = ? AND expires_at > ?")
    .bind(await operatorHash(token), await configurationHash(env), Date.now()).first();
  return row ? env.OPERATOR_EMAIL! : null;
}
/** Obligatorio incluso en GET: otros sitios no pueden usar una cookie del operador. */
export function operatorRequestAllowed(request: Request, env: OperatorConfig): boolean {
  if (!operatorOriginAllowed(request, env) || request.headers.get("X-OpenDomus-Operator") !== "browser") return false;
  const site = request.headers.get("Sec-Fetch-Site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("Origin");
  return ["GET", "HEAD"].includes(request.method) ? (!origin || origin === env.APP_ORIGIN) : origin === env.APP_ORIGIN;
}
async function limited(env: AppEnv["Bindings"], key: string, max: number) {
  const now = Date.now(), cutoff = now - 15 * 60_000;
  const row = await env.DB.prepare(`INSERT INTO attempts (key, count, window_start) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window_start < ? THEN 1 ELSE count + 1 END,
    window_start = CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END RETURNING count`)
    .bind(key, now, cutoff, cutoff).first<{ count: number }>();
  return !row || row.count > max;
}

export const operatorAuth = new Hono<AppEnv>();
operatorAuth.use("*", bodyLimit({ maxSize: 2048, onError: (c) => c.json({ error: "too-large" }, 413) }));
operatorAuth.use("*", async (c, next) => {
  if (!operatorConfigured(c.env)) return c.json({ error: "not-configured" }, 404);
  if (!operatorRequestAllowed(c.req.raw, c.env)) return c.json({ error: "forbidden-origin" }, 403);
  return next();
});
operatorAuth.post("/login", async (c) => {
  const input: unknown = await c.req.json().catch(() => null);
  if (!input || typeof input !== "object" || !("key" in input) || !("code" in input) ||
    typeof input.key !== "string" || !/^[a-f0-9]{64}$/.test(input.key) || typeof input.code !== "string" || !/^\d{6}$/.test(input.code)) return c.json({ error: "invalid-credentials" }, 401);
  // Una cantidad fija de buckets evita crecimiento ilimitado por direcciones IP inventadas.
  const ip = await operatorHash(c.req.header("CF-Connecting-IP") ?? "local");
  if (await limited(c.env, `operator:ip:${ip.slice(0, 3)}`, 10)) return c.json({ error: "rate-limited" }, 429);
  if (!equal(await operatorHash(input.key), c.env.OPERATOR_KEY_HASH!)) return c.json({ error: "invalid-credentials" }, 401);
  // Solo alguien con la clave correcta puede consumir el cupo global del segundo factor.
  if (await limited(c.env, "operator:totp", 10)) return c.json({ error: "rate-limited" }, 429);
  const current = Math.floor(Date.now() / 30_000);
  let accepted: number | null = null;
  for (const step of [current - 1, current, current + 1]) {
    if (equal(await operatorTotp(c.env.OPERATOR_TOTP_SECRET!, step), input.code)) accepted = step;
  }
  if (accepted === null) return c.json({ error: "invalid-credentials" }, 401);
  const config = await configurationHash(c.env);
  // CAS en D1: un código no puede iniciar dos sesiones, ni con peticiones concurrentes.
  const used = await c.env.DB.prepare(`INSERT INTO operator_totp (config_hash, last_step) VALUES (?, ?)
    ON CONFLICT(config_hash) DO UPDATE SET last_step = excluded.last_step WHERE last_step < excluded.last_step RETURNING last_step`)
    .bind(config, accepted).first();
  if (!used) return c.json({ error: "invalid-credentials" }, 401);
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM operator_sessions WHERE expires_at <= ? OR config_hash != ?").bind(Date.now(), config),
    c.env.DB.prepare("DELETE FROM operator_totp WHERE config_hash != ?").bind(config),
    c.env.DB.prepare("INSERT INTO operator_sessions (token_hash, config_hash, expires_at) VALUES (?, ?, ?)").bind(await operatorHash(token), config, Date.now() + HOUR),
  ]);
  c.header("Set-Cookie", cookie(c.req.raw, token, HOUR / 1000));
  return c.json({ email: c.env.OPERATOR_EMAIL });
});
operatorAuth.get("/session", async (c) => {
  const email = await operatorSession(c.req.raw, c.env);
  return email ? c.json({ email }) : c.json({ error: "unauthorized" }, 401);
});
operatorAuth.post("/logout", async (c) => {
  const token = sessionToken(c.req.raw);
  if (token) await c.env.DB.prepare("DELETE FROM operator_sessions WHERE token_hash = ?").bind(await operatorHash(token)).run();
  c.header("Set-Cookie", cookie(c.req.raw, "", 0));
  return c.json({ ok: true });
});
