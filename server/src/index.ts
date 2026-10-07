/**
 * Worker de OpenDomus: sirve la app (archivos estáticos) y la API en el mismo origen (`/api/*`),
 * así las cookies de sesión son de primera parte: sin CORS ni cookies de terceros en producción.
 *
 * Cifrado de extremo a extremo: el servidor guarda claves y datos ya cifrados en los dispositivos.
 * Su trabajo es autenticar, autorizar (quién es miembro de qué casa, con qué rol) y ordenar.
 */
import { betterAuth } from "better-auth";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import type { z } from "zod";
import { opSigningData, SYNC_LIMITS } from "../../src/lib/sync/protocol";
import { authOptions } from "./auth-options";
import { enabledSocialProviders, socialProviders } from "./social-auth";
import type { AppEnv, Env, SessionUser } from "./env";
import { DAY, INACTIVITY_NOTICE_DAYS, inactivityNoticeWindow, inactiveBefore } from "./inactivity";
import { PhotoStorageError, photoStorage } from "./photo-storage";
import { operatorAuth, operatorConfigured, operatorRequestAllowed, operatorSession } from "./operator-auth";
import { operatorPage } from "./operator-page";
import { OP_CONFLICT } from "./sync";
import {
  acceptInviteInput,
  changePasswordInput,
  changeRoleInput,
  createHouseholdInput,
  createInviteInput,
  createLicensesInput,
  deleteHouseholdInput,
  envelopeInput,
  feedbackInput,
  feedbackStatusInput,
  inactivityNoticeStatusInput,
  inviteTokenInput,
  licenseCheckInput,
  pullQuery,
  pushInput,
  recoveryCompleteInput,
  recoveryKitInput,
  recoveryStartInput,
  removeMemberInput,
  userId,
  userKeysInput,
  uuid,
  type Role,
  type Scope,
} from "./validation";

export { HouseholdLog } from "./sync";

function allowedOrigins(env: Env) {
  return [env.APP_ORIGIN, ...(env.DEV_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean)];
}

function createAuth(env: Env) {
  return betterAuth(
    authOptions(env.DB, {
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.APP_ORIGIN,
      trustedOrigins: allowedOrigins(env),
      ...socialProviders(env),
    }),
  );
}

/** Qué niveles de privacidad puede abrir cada rol: los chicos no ven "Adultos". */
function scopesFor(role: Role): Scope[] {
  return role === "kid" ? ["family", "private"] : ["family", "adults", "private"];
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64u(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)), (char) => char.charCodeAt(0));
}

/** Firma Ed25519 válida (una clave o firma mal formada cuenta como inválida). */
async function verifySignature(publicKey: string, data: string, signature: string) {
  try {
    const key = await crypto.subtle.importKey("raw", fromB64u(publicKey), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, fromB64u(signature), new TextEncoder().encode(data));
  } catch {
    return false;
  }
}

/** "od-abcd efgh…" → "ODABCDEFGH…": el código se compara sin guiones ni espacios, en mayúscula. */
function normalizeLicenseCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Comparación en tiempo constante (no corta en el primer carácter distinto). */
function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

const app = new Hono<AppEnv>().basePath("/api");

// Encabezados de seguridad en toda respuesta de la API.
app.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
});

// CORS solo para los orígenes de desarrollo (en producción la app y la API comparten origen).
app.use("*", async (c, next) => {
  const dev = (c.env.DEV_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
  if (dev.length === 0) return next();
  return cors({ origin: dev, credentials: true, allowHeaders: ["Content-Type"], allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] })(c, next);
});

// CSRF: todo lo que cambia algo tiene que venir de la app (Origin conocido). Better Auth valida lo suyo.
app.use("*", async (c, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(c.req.method) || c.req.path.startsWith("/api/auth/") || c.req.path.startsWith("/api/admin/")) return next();
  const origin = c.req.header("Origin");
  if (!origin || !allowedOrigins(c.env).includes(origin)) return c.json({ error: "forbidden-origin" }, 403);
  return next();
});

app.use("/auth/*", bodyLimit({ maxSize: 16 * 1024, onError: (c) => c.json({ error: "too-large" }, 413) }));
app.use("/feedback", bodyLimit({ maxSize: 8 * 1024, onError: (c) => c.json({ error: "too-large" }, 413) }));
app.on(["GET", "POST"], "/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

app.get("/health", (c) => c.json({ ok: true }));

app.get("/social-providers", (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ providers: enabledSocialProviders(c.env) });
});

/** Exige sesión. */
async function requireUser(c: Context<AppEnv>): Promise<SessionUser | null> {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) return null;
  const user = { id: session.user.id, name: session.user.name, email: session.user.email };
  c.set("user", user);
  c.set("sessionId", session.session.id);
  return user;
}

/**
 * Límite de intentos (ventana fija) para lo que no pasa por Better Auth. En la base: cada isolate
 * del Worker tiene su propia memoria. Devuelve `true` si ya se pasó del máximo.
 */
async function tooMany(env: Env, key: string, max: number, windowMs: number) {
  const now = Date.now();
  const row = await env.DB.prepare(
    `insert into attempts (key, count, window_start) values (?, 1, ?)
       on conflict (key) do update set
         count = case when attempts.window_start < ? then 1 else attempts.count + 1 end,
         window_start = case when attempts.window_start < ? then excluded.window_start else attempts.window_start end
     returning count`,
  )
    .bind(key, now, now - windowMs, now - windowMs)
    .first<{ count: number }>();
  return (row?.count ?? 0) > max;
}

const clientIp = (c: Context<AppEnv>) => c.req.header("cf-connecting-ip") ?? "local";

/** ¿Es la contraseña (la clave derivada) de esta persona? Con el mismo hash que usa Better Auth. */
async function checkPassword(env: Env, userId: string, password: string) {
  const account = await env.DB.prepare(`select "password" from "account" where "userId" = ? and "providerId" = 'credential'`).bind(userId).first<{ password: string | null }>();
  if (!account?.password) return false;
  return (await createAuth(env).$context).password.verify({ hash: account.password, password });
}

/** Cambia la contraseña: la sentencia va en el mismo lote (transacción) que el cambio de claves. */
async function setPasswordStatement(env: Env, userId: string, password: string) {
  const hash = await (await createAuth(env).$context).password.hash(password);
  return env.DB.prepare(`update "account" set "password" = ?, "updatedAt" = ? where "userId" = ? and "providerId" = 'credential'`).bind(hash, new Date().toISOString(), userId);
}

async function parse<T extends z.ZodTypeAny>(c: Context<AppEnv>, schema: T): Promise<z.infer<T> | null> {
  const result = schema.safeParse(await c.req.json().catch(() => null));
  return result.success ? result.data : null;
}

async function membership(env: Env, householdId: string, userId: string) {
  return env.DB.prepare("select role from memberships where household_id = ? and user_id = ?").bind(householdId, userId).first<{ role: Role }>();
}

async function touchHousehold(env: Env, householdId: string, now = Date.now()) {
  await env.DB.batch([
    env.DB.prepare("update households set last_activity_at = ? where id = ? and coalesce(last_activity_at, 0) < ?").bind(now, householdId, now - DAY),
    env.DB.prepare("update inactivity_notices set status = 'cancelled', updated_at = ? where household_id = ? and status = 'pending'").bind(now, householdId),
  ]);
}

async function processInactivity(env: Env, now = Date.now()) {
  const statements = INACTIVITY_NOTICE_DAYS.map((daysBeforePause, index) => {
    const window = inactivityNoticeWindow(daysBeforePause, index, now);
    return env.DB
      .prepare(
      `insert into inactivity_notices (household_id, days_before_pause, due_at, status, created_at, updated_at)
       select h.id, ?, coalesce(h.last_activity_at, h.created_at) + ?, 'pending', ?, ?
         from households h join household_plans p on p.household_id = h.id
        where p.status = 'active'
          and coalesce(h.last_activity_at, h.created_at) <= ?
          and coalesce(h.last_activity_at, h.created_at) > ?
       on conflict (household_id, days_before_pause) do nothing`,
      )
      .bind(
        daysBeforePause,
        window.dueAtOffset,
        now,
        now,
        window.activeBefore,
        window.activeAfter,
      );
  });
  const results = await env.DB.batch([
    ...statements,
    env.DB.prepare(
      `update household_plans
          set status = 'paused', updated_at = ?
        where status = 'active'
          and household_id in (
            select id from households where coalesce(last_activity_at, created_at) <= ?
          )`,
    ).bind(now, inactiveBefore(now)),
  ]);
  return {
    noticesQueued: results.slice(0, INACTIVITY_NOTICE_DAYS.length).reduce((total, result) => total + result.meta.changes, 0),
    householdsPaused: results[results.length - 1].meta.changes,
  };
}

// --- Mis claves ------------------------------------------------------------------------

app.post("/keys", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const input = await parse(c, userKeysInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  const now = Date.now();
  // Una sola vez: cambiar las claves (contraseña nueva, recuperación) es otro flujo, con su propia prueba.
  const result = await c.env.DB.prepare(
    "insert into user_keys (user_id, kdf_version, enc_public_key, sign_public_key, private_keys, recovery_private_keys, recovery_verifier, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?) on conflict (user_id) do nothing",
  )
    .bind(user.id, input.kdfVersion, input.encPublicKey, input.signPublicKey, input.privateKeys, input.recoveryPrivateKeys, input.recoveryVerifier, now, now)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "keys-exist" }, 409);
  return c.json({ ok: true }, 201);
});

app.get("/me", async (c) => {
  const user = await requireUser(c);
  // "¿Hay sesión?" es una pregunta normal al abrir la app, no un error: sin sesión, `user: null`.
  if (!user) return c.json({ user: null });
  const keys = await c.env.DB.prepare(
    "select kdf_version as kdfVersion, enc_public_key as encPublicKey, sign_public_key as signPublicKey, private_keys as privateKeys from user_keys where user_id = ?",
  )
    .bind(user.id)
    .first();
  const households = await c.env.DB.prepare(
    `select h.id, h.encrypted_name as encryptedName, h.family_key_version as familyKeyVersion, h.adults_key_version as adultsKeyVersion, m.role,
            coalesce(h.last_activity_at, h.created_at) as lastActivityAt,
            coalesce(p.plan, 'beta') as plan, coalesce(p.status, 'active') as planStatus
       from memberships m join households h on h.id = m.household_id left join household_plans p on p.household_id = h.id
      where m.user_id = ? order by m.joined_at`,
  )
    .bind(user.id)
    .all<{ id: string; encryptedName: string; familyKeyVersion: number; adultsKeyVersion: number; role: Role; lastActivityAt: number; plan: string; planStatus: "active" | "paused" }>();
  const envelopes = await c.env.DB.prepare(
    "select household_id as householdId, scope, version, envelope from key_envelopes where recipient_user_id = ?",
  )
    .bind(user.id)
    .all<{ householdId: string; scope: Scope; version: number; envelope: string }>();
  await Promise.all(households.results.map((household) => touchHousehold(c.env, household.id)));
  return c.json({
    user,
    keys,
    households: households.results.map((household) => ({
      ...household,
      envelopes: envelopes.results.filter((entry) => entry.householdId === household.id).map(({ scope, version, envelope }) => ({ scope, version, envelope })),
    })),
  });
});

// --- Recuperar con el kit (sin sesión y sin email) -----------------------------------------

const RECOVERY_WINDOW = 15 * 60_000;

/**
 * La cuenta, si la prueba del kit es la correcta. La comparación se hace siempre (también si el
 * email no tiene cuenta) y la respuesta es la misma: no se puede averiguar qué emails existen.
 */
async function findRecovery(env: Env, email: string, recoveryAuth: string) {
  const row = await env.DB.prepare(
    `select u.id as userId, k.kdf_version as kdfVersion, k.enc_public_key as encPublicKey, k.sign_public_key as signPublicKey,
            k.recovery_private_keys as recoveryPrivateKeys, k.recovery_verifier as verifier
       from "user" u join user_keys k on k.user_id = u.id where u.email = ?`,
  )
    .bind(email)
    .first<{ userId: string; kdfVersion: number; encPublicKey: string; signPublicKey: string; recoveryPrivateKeys: string; verifier: string | null }>();
  const matches = timingSafeEqual(row?.verifier ?? "-".repeat(43), await sha256(recoveryAuth));
  return row?.verifier && matches ? row : null;
}

async function recoveryLimited(c: Context<AppEnv>, email: string) {
  return (await tooMany(c.env, `recovery:ip:${clientIp(c)}`, 20, RECOVERY_WINDOW)) || (await tooMany(c.env, `recovery:email:${email}`, 5, RECOVERY_WINDOW));
}

/** Paso 1: con email + prueba del kit, la copia de las claves cifrada con el kit (se abre en el dispositivo). */
app.post("/recovery/start", async (c) => {
  const input = await parse(c, recoveryStartInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  if (await recoveryLimited(c, input.email)) return c.json({ error: "rate-limited" }, 429);
  const found = await findRecovery(c.env, input.email, input.recoveryAuth);
  if (!found) return c.json({ error: "recovery-failed" }, 403);
  return c.json({ kdfVersion: found.kdfVersion, encPublicKey: found.encPublicKey, signPublicKey: found.signPublicKey, recoveryPrivateKeys: found.recoveryPrivateKeys });
});

/**
 * Paso 2: contraseña nueva, claves re-cifradas con ella y un kit nuevo (el usado deja de servir),
 * todo junto. Se cierran todas las sesiones: quien tuviera la contraseña vieja queda afuera.
 */
app.post("/recovery/complete", async (c) => {
  const input = await parse(c, recoveryCompleteInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  if (await recoveryLimited(c, input.email)) return c.json({ error: "rate-limited" }, 429);
  const found = await findRecovery(c.env, input.email, input.recoveryAuth);
  if (!found) return c.json({ error: "recovery-failed" }, 403);
  await c.env.DB.batch([
    await setPasswordStatement(c.env, found.userId, input.newPassword),
    c.env.DB.prepare("update user_keys set private_keys = ?, recovery_private_keys = ?, recovery_verifier = ?, updated_at = ? where user_id = ?").bind(
      input.privateKeys,
      input.recoveryPrivateKeys,
      input.recoveryVerifier,
      Date.now(),
      found.userId,
    ),
    c.env.DB.prepare(`delete from "session" where "userId" = ?`).bind(found.userId),
  ]);
  return c.json({ ok: true });
});

// --- Mi cuenta: contraseña, kit y dispositivos ---------------------------------------------

/** Cambiar la contraseña sabiendo la actual. Las otras sesiones se cierran; esta sigue. */
app.post("/account/password", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const input = await parse(c, changePasswordInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  if (await tooMany(c.env, `password:${user.id}`, 5, RECOVERY_WINDOW)) return c.json({ error: "rate-limited" }, 429);
  if (!(await checkPassword(c.env, user.id, input.currentPassword))) return c.json({ error: "wrong-password" }, 403);
  await c.env.DB.batch([
    await setPasswordStatement(c.env, user.id, input.newPassword),
    c.env.DB.prepare("update user_keys set private_keys = ?, updated_at = ? where user_id = ?").bind(input.privateKeys, Date.now(), user.id),
    c.env.DB.prepare(`delete from "session" where "userId" = ? and "id" <> ?`).bind(user.id, c.var.sessionId),
  ]);
  return c.json({ ok: true });
});

/** Un kit nuevo (si el anterior se perdió o se vio): el anterior deja de servir. Pide la contraseña. */
app.post("/account/recovery-kit", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const input = await parse(c, recoveryKitInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  if (await tooMany(c.env, `password:${user.id}`, 5, RECOVERY_WINDOW)) return c.json({ error: "rate-limited" }, 429);
  if (!(await checkPassword(c.env, user.id, input.password))) return c.json({ error: "wrong-password" }, 403);
  await c.env.DB.prepare("update user_keys set recovery_private_keys = ?, recovery_verifier = ?, updated_at = ? where user_id = ?")
    .bind(input.recoveryPrivateKeys, input.recoveryVerifier, Date.now(), user.id)
    .run();
  return c.json({ ok: true });
});

/** Dónde está abierta la cuenta (sin los tokens: no salen nunca). */
app.get("/account/devices", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const sessions = await c.env.DB.prepare(
    `select "id", "userAgent", "createdAt", "updatedAt" from "session" where "userId" = ? and "expiresAt" > ? order by "updatedAt" desc`,
  )
    .bind(user.id, new Date().toISOString())
    .all<{ id: string; userAgent: string | null; createdAt: string; updatedAt: string }>();
  return c.json({
    devices: sessions.results.map((session) => ({
      id: session.id,
      userAgent: session.userAgent ?? "",
      createdAt: Date.parse(session.createdAt),
      lastActiveAt: Date.parse(session.updatedAt),
      current: session.id === c.var.sessionId,
    })),
  });
});

/** Cerrar la sesión de un dispositivo (deja de sincronizar; su copia local queda como estaba). */
app.delete("/account/devices/:id", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  await c.env.DB.prepare(`delete from "session" where "id" = ? and "userId" = ?`).bind(c.req.param("id"), user.id).run();
  return c.json({ ok: true });
});

// --- Casas -------------------------------------------------------------------------------

app.post("/households", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const input = await parse(c, createHouseholdInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  const hasKeys = await c.env.DB.prepare("select 1 from user_keys where user_id = ?").bind(user.id).first();
  if (!hasKeys) return c.json({ error: "no-keys" }, 409);
  const scopes = new Set(input.envelopes.map((entry) => entry.scope));
  if (!scopes.has("family") || !scopes.has("adults") || input.envelopes.some((entry) => entry.version !== 1)) return c.json({ error: "invalid-envelopes" }, 400);

  const now = Date.now();
  const open = c.env.HOUSEHOLD_ACCESS === "open";
  if (!open) {
    if (await tooMany(c.env, `license:${user.id}`, 10, RECOVERY_WINDOW)) return c.json({ error: "rate-limited" }, 429);
    if (!input.accessCode) return c.json({ error: "license-required" }, 403);
  }
  const codeHash = input.accessCode ? await sha256(normalizeLicenseCode(input.accessCode)) : "";
  // batch = una transacción en D1: o se crea todo, o nada. Con licencia, primero se consume (si
  // es válida, está activa, no venció y le quedan usos) y la casa se crea solo si se consumió.
  const results = await c.env.DB.batch([
    open
      ? c.env.DB.prepare("select 1")
      : c.env.DB.prepare(
          "update cloud_licenses set used = used + 1 where code_hash = ? and status = 'active' and used < max_households and (expires_at is null or expires_at > ?)",
        ).bind(codeHash, now),
    c.env.DB.prepare(`insert into households (id, encrypted_name, created_by, created_at) select ?, ?, ?, ? where ${open ? "1" : "changes() = 1"}`).bind(
      input.id,
      input.encryptedName,
      user.id,
      now,
    ),
    c.env.DB.prepare("insert into memberships (household_id, user_id, role, joined_at) select ?, ?, 'admin', ? where exists (select 1 from households where id = ?)").bind(
      input.id,
      user.id,
      now,
      input.id,
    ),
    ...input.envelopes.map((entry) =>
      c.env.DB.prepare(
        "insert into key_envelopes (household_id, scope, version, recipient_user_id, envelope, created_by, created_at) select ?, ?, ?, ?, ?, ?, ? where exists (select 1 from households where id = ?)",
      ).bind(input.id, entry.scope, entry.version, user.id, entry.envelope, user.id, now, input.id),
    ),
    c.env.DB.prepare(
      `insert into household_plans (household_id, license_id, plan, status, updated_at)
         select ?, l.id, coalesce(l.plan, 'beta'), 'active', ?
           from (select 1) left join cloud_licenses l on l.code_hash = ?
          where exists (select 1 from households where id = ?)`,
    ).bind(input.id, now, codeHash, input.id),
  ]);
  if (results[1].meta.changes === 0) return c.json({ error: "license-invalid" }, 403);
  return c.json({ id: input.id }, 201);
});

/** Antes de crear la cuenta: ¿el código de licencia sirve? (No lo consume.) */
app.post("/licenses/check", async (c) => {
  const input = await parse(c, licenseCheckInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  if (await tooMany(c.env, `license-check:${clientIp(c)}`, 20, RECOVERY_WINDOW)) return c.json({ error: "rate-limited" }, 429);
  if (c.env.HOUSEHOLD_ACCESS === "open") return c.json({ valid: true });
  const license = await c.env.DB.prepare(
    "select 1 from cloud_licenses where code_hash = ? and status = 'active' and used < max_households and (expires_at is null or expires_at > ?)",
  )
    .bind(await sha256(normalizeLicenseCode(input.code)), Date.now())
    .first();
  return c.json({ valid: !!license });
});

app.get("/households/:id/members", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if (!(await membership(c.env, householdId, user.id))) return c.json({ error: "not-found" }, 404);
  const members = await c.env.DB.prepare(
    `select m.user_id as userId, u.name, m.role, m.joined_at as joinedAt, k.enc_public_key as encPublicKey, k.sign_public_key as signPublicKey
       from memberships m join "user" u on u.id = m.user_id left join user_keys k on k.user_id = m.user_id
      where m.household_id = ? order by m.joined_at`,
  )
    .bind(householdId)
    .all();
  // Quienes se fueron: solo su rol de entonces y su clave de firma, para verificar sus cambios viejos.
  const former = await c.env.DB.prepare(
    `select f.user_id as userId, u.name, f.role, f.removed_at as removedAt, k.sign_public_key as signPublicKey
       from former_members f join "user" u on u.id = f.user_id left join user_keys k on k.user_id = f.user_id
      where f.household_id = ? order by f.removed_at`,
  )
    .bind(householdId)
    .all();
  return c.json({ members: members.results, former: former.results });
});

/**
 * Sacar a alguien de la casa. Quien lo saca manda claves NUEVAS de los niveles que esa persona
 * tenía (Familia siempre; Adultos si no era chico), ensobradas para cada uno de los que quedan, y
 * el nombre de la casa cifrado con la Familia nueva. Desde acá, lo nuevo se cifra con claves que
 * esa persona no tiene. Las invitaciones pendientes se anulan (llevaban las claves viejas).
 */
app.post("/households/:id/members/:userId/remove", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  const targetId = c.req.param("userId");
  if ((await membership(c.env, householdId, user.id))?.role !== "admin") return c.json({ error: "forbidden" }, 403);
  if (targetId === user.id) return c.json({ error: "self" }, 400);
  const target = await membership(c.env, householdId, targetId);
  if (!target) return c.json({ error: "not-found" }, 404);
  const input = await parse(c, removeMemberInput);
  if (!input) return c.json({ error: "invalid" }, 400);

  const household = await c.env.DB.prepare("select family_key_version as family, adults_key_version as adults from households where id = ?")
    .bind(householdId)
    .first<{ family: number; adults: number }>();
  const remaining = await c.env.DB.prepare("select user_id as userId, role from memberships where household_id = ? and user_id <> ?")
    .bind(householdId, targetId)
    .all<{ userId: string; role: Role }>();
  if (!household) return c.json({ error: "not-found" }, 404);

  // Cada nivel que tenía se rota a la versión siguiente, con un sobre para cada uno de los que lo pueden abrir.
  const needed: ("family" | "adults")[] = target.role === "kid" ? ["family"] : ["family", "adults"];
  const byScope = new Map(input.rotation.map((entry) => [entry.scope, entry]));
  if (byScope.size !== input.rotation.length || needed.some((scope) => !byScope.has(scope)) || input.rotation.some((entry) => !needed.includes(entry.scope))) {
    return c.json({ error: "invalid-rotation" }, 400);
  }
  for (const scope of needed) {
    const entry = byScope.get(scope)!;
    const expected = remaining.results.filter((member) => scopesFor(member.role).includes(scope)).map((member) => member.userId);
    const given = entry.envelopes.map((envelope) => envelope.userId);
    if (entry.version !== household[scope] + 1) return c.json({ error: "stale-key" }, 409);
    // Alguien entró o cambió de rol mientras tanto: hay que volver a armar los sobres.
    if (new Set(given).size !== given.length || given.length !== expected.length || !expected.every((id) => given.includes(id))) {
      return c.json({ error: "members-changed" }, 409);
    }
  }

  const now = Date.now();
  const family = byScope.get("family")!;
  const adults = byScope.get("adults");
  await c.env.DB.batch([
    c.env.DB.prepare("delete from memberships where household_id = ? and user_id = ?").bind(householdId, targetId),
    c.env.DB.prepare("delete from key_envelopes where household_id = ? and recipient_user_id = ?").bind(householdId, targetId),
    c.env.DB.prepare(
      "insert into former_members (household_id, user_id, role, removed_at, removed_by) values (?, ?, ?, ?, ?) on conflict do update set role = excluded.role, removed_at = excluded.removed_at, removed_by = excluded.removed_by",
    ).bind(householdId, targetId, target.role, now, user.id),
    ...input.rotation.flatMap((entry) =>
      entry.envelopes.map((envelope) =>
        c.env.DB.prepare(
          "insert into key_envelopes (household_id, scope, version, recipient_user_id, envelope, created_by, created_at) values (?, ?, ?, ?, ?, ?, ?)",
        ).bind(householdId, entry.scope, entry.version, envelope.userId, envelope.envelope, user.id, now),
      ),
    ),
    c.env.DB.prepare("update households set encrypted_name = ?, family_key_version = ?, adults_key_version = ? where id = ?").bind(
      input.encryptedName,
      family.version,
      adults?.version ?? household.adults,
      householdId,
    ),
    c.env.DB.prepare("delete from invites where household_id = ? and used_at is null").bind(householdId),
  ]);
  return c.json({ ok: true });
});

app.patch("/households/:id/members/:userId", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if ((await membership(c.env, householdId, user.id))?.role !== "admin") return c.json({ error: "forbidden" }, 403);
  const input = await parse(c, changeRoleInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  const target = await membership(c.env, householdId, c.req.param("userId"));
  if (!target) return c.json({ error: "not-found" }, 404);
  if (target.role === "admin" && input.role !== "admin") {
    const admins = await c.env.DB.prepare("select count(*) as count from memberships where household_id = ? and role = 'admin'").bind(householdId).first<{ count: number }>();
    if ((admins?.count ?? 0) <= 1) return c.json({ error: "last-admin" }, 409);
  }
  const targetId = c.req.param("userId");
  const setRole = c.env.DB.prepare("update memberships set role = ? where household_id = ? and user_id = ?").bind(input.role, householdId, targetId);
  if (input.role !== "kid" || target.role === "kid") {
    await setRole.run();
    return c.json({ ok: true });
  }

  // Pasar a chico: deja de ver "Adultos", y como ya tenía esa clave, se rota (igual que al sacar
  // a alguien) para que no pueda abrir lo que se escriba desde ahora.
  if (!input.rotation) return c.json({ error: "rotation-required" }, 400);
  const household = await c.env.DB.prepare("select adults_key_version as adults from households where id = ?").bind(householdId).first<{ adults: number }>();
  const adultsAfter = await c.env.DB.prepare("select user_id as userId from memberships where household_id = ? and user_id <> ? and role <> 'kid'")
    .bind(householdId, targetId)
    .all<{ userId: string }>();
  if (!household) return c.json({ error: "not-found" }, 404);
  if (input.rotation.version !== household.adults + 1) return c.json({ error: "stale-key" }, 409);
  const expected = adultsAfter.results.map((member) => member.userId);
  const given = input.rotation.envelopes.map((envelope) => envelope.userId);
  if (new Set(given).size !== given.length || given.length !== expected.length || !expected.every((id) => given.includes(id))) {
    return c.json({ error: "members-changed" }, 409);
  }
  const now = Date.now();
  await c.env.DB.batch([
    setRole,
    c.env.DB.prepare("delete from key_envelopes where household_id = ? and recipient_user_id = ? and scope = 'adults'").bind(householdId, targetId),
    ...input.rotation.envelopes.map((envelope) =>
      c.env.DB.prepare(
        "insert into key_envelopes (household_id, scope, version, recipient_user_id, envelope, created_by, created_at) values (?, 'adults', ?, ?, ?, ?, ?)",
      ).bind(householdId, input.rotation!.version, envelope.userId, envelope.envelope, user.id, now),
    ),
    c.env.DB.prepare("update households set adults_key_version = ? where id = ?").bind(input.rotation.version, householdId),
    // Las invitaciones pendientes llevaban la clave de Adultos vieja.
    c.env.DB.prepare("delete from invites where household_id = ? and used_at is null").bind(householdId),
  ]);
  return c.json({ ok: true });
});

/**
 * Entregar claves a otro miembro (ej. al pasar de chico a adulto, se le entrega "Adultos").
 * El servidor no puede verificar el contenido; sí que quien entrega tenga ese nivel y que el
 * destinatario lo pueda tener según su rol.
 */
app.post("/households/:id/envelopes", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  const sender = await membership(c.env, householdId, user.id);
  const body = (await c.req.json().catch(() => null)) as { recipientUserId?: unknown; envelopes?: unknown } | null;
  const recipientId = userId.safeParse(body?.recipientUserId);
  const envelopes = envelopeInput.array().min(1).max(2).safeParse(body?.envelopes);
  if (!sender || !recipientId.success || !envelopes.success) return c.json({ error: "invalid" }, 400);
  const recipient = await membership(c.env, householdId, recipientId.data);
  if (!recipient) return c.json({ error: "not-found" }, 404);
  const allowed = envelopes.data.every((entry) => entry.scope !== "private" && scopesFor(sender.role).includes(entry.scope) && scopesFor(recipient.role).includes(entry.scope));
  if (!allowed) return c.json({ error: "forbidden" }, 403);
  const now = Date.now();
  await c.env.DB.batch(
    envelopes.data.map((entry) =>
      c.env.DB.prepare(
        "insert into key_envelopes (household_id, scope, version, recipient_user_id, envelope, created_by, created_at) values (?, ?, ?, ?, ?, ?, ?) on conflict do update set envelope = excluded.envelope, created_by = excluded.created_by, created_at = excluded.created_at",
      ).bind(householdId, entry.scope, entry.version, recipientId.data, entry.envelope, user.id, now),
    ),
  );
  return c.json({ ok: true });
});

// --- Invitaciones -------------------------------------------------------------------------

app.post("/households/:id/invites", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if ((await membership(c.env, householdId, user.id))?.role !== "admin") return c.json({ error: "forbidden" }, 403);
  const input = await parse(c, createInviteInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  const now = Date.now();
  const expiresAt = now + input.expiresInDays * DAY;
  await c.env.DB.prepare(
    "insert into invites (id, household_id, role, token_hash, wrapped_keys, created_by, created_at, expires_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(input.id, householdId, input.role, input.tokenHash, input.wrappedKeys, user.id, now, expiresAt)
    .run();
  return c.json({ id: input.id, expiresAt }, 201);
});

app.get("/households/:id/invites", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if ((await membership(c.env, householdId, user.id))?.role !== "admin") return c.json({ error: "forbidden" }, 403);
  const invites = await c.env.DB.prepare(
    "select id, role, created_at as createdAt, expires_at as expiresAt, used_at as usedAt from invites where household_id = ? and (used_at is null and expires_at > ?) order by created_at desc",
  )
    .bind(householdId, Date.now())
    .all();
  return c.json({ invites: invites.results });
});

app.delete("/households/:id/invites/:inviteId", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if ((await membership(c.env, householdId, user.id))?.role !== "admin") return c.json({ error: "forbidden" }, 403);
  await c.env.DB.prepare("delete from invites where id = ? and household_id = ?").bind(c.req.param("inviteId"), householdId).run();
  return c.json({ ok: true });
});

/** Valida el token de una invitación (sin sesión: se usa antes de crear la cuenta). */
async function findInvite(env: Env, id: string, authToken: string) {
  const invite = await env.DB.prepare(
    `select i.id, i.household_id as householdId, i.role, i.token_hash as tokenHash, i.wrapped_keys as wrappedKeys, i.expires_at as expiresAt, i.used_at as usedAt, u.name as inviterName
       from invites i join "user" u on u.id = i.created_by where i.id = ?`,
  )
    .bind(id)
    .first<{ id: string; householdId: string; role: Role; tokenHash: string; wrappedKeys: string; expiresAt: number; usedAt: number | null; inviterName: string }>();
  // Mismo error para "no existe" y "token incorrecto": no se puede averiguar qué invitaciones hay.
  if (!invite || !timingSafeEqual(invite.tokenHash, await sha256(authToken))) return { error: "not-found" as const };
  if (invite.usedAt) return { error: "used" as const };
  if (invite.expiresAt < Date.now()) return { error: "expired" as const };
  return { invite };
}

app.post("/invites/:id/preview", async (c) => {
  const input = await parse(c, inviteTokenInput);
  if (!input || !uuid.safeParse(c.req.param("id")).success) return c.json({ error: "invalid" }, 400);
  const found = await findInvite(c.env, c.req.param("id"), input.authToken);
  if ("error" in found) return c.json({ error: found.error }, found.error === "not-found" ? 404 : 410);
  const { invite } = found;
  return c.json({ householdId: invite.householdId, role: invite.role, wrappedKeys: invite.wrappedKeys, inviterName: invite.inviterName, expiresAt: invite.expiresAt });
});

app.post("/invites/:id/accept", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const input = await parse(c, acceptInviteInput);
  if (!input || !uuid.safeParse(c.req.param("id")).success) return c.json({ error: "invalid" }, 400);
  const found = await findInvite(c.env, c.req.param("id"), input.authToken);
  if ("error" in found) return c.json({ error: found.error }, found.error === "not-found" ? 404 : 410);
  const { invite } = found;
  if (await membership(c.env, invite.householdId, user.id)) return c.json({ error: "already-member" }, 409);
  const hasKeys = await c.env.DB.prepare("select 1 from user_keys where user_id = ?").bind(user.id).first();
  if (!hasKeys) return c.json({ error: "no-keys" }, 409);

  const household = await c.env.DB.prepare("select family_key_version as family, adults_key_version as adults from households where id = ?")
    .bind(invite.householdId)
    .first<{ family: number; adults: number }>();
  if (!household) return c.json({ error: "not-found" }, 404);
  // Solo los niveles que permite su rol, y en la versión vigente de cada clave.
  const allowed = scopesFor(invite.role);
  const valid = input.envelopes.every(
    (entry) => allowed.includes(entry.scope) && entry.version === (entry.scope === "private" ? 1 : household[entry.scope as "family" | "adults"]),
  );
  if (!valid || !input.envelopes.some((entry) => entry.scope === "family")) return c.json({ error: "invalid-envelopes" }, 400);

  const now = Date.now();
  // El "used_at is null" en el update hace que dos aceptaciones simultáneas no entren las dos.
  const results = await c.env.DB.batch([
    c.env.DB.prepare("update invites set used_at = ?, used_by = ? where id = ? and used_at is null").bind(now, user.id, invite.id),
    c.env.DB.prepare("insert into memberships (household_id, user_id, role, joined_at) select ?, ?, ?, ? where changes() = 1").bind(invite.householdId, user.id, invite.role, now),
    ...input.envelopes.map((entry) =>
      c.env.DB.prepare(
        "insert into key_envelopes (household_id, scope, version, recipient_user_id, envelope, created_by, created_at) select ?, ?, ?, ?, ?, ?, ? where exists (select 1 from memberships where household_id = ? and user_id = ?)",
      ).bind(invite.householdId, entry.scope, entry.version, user.id, entry.envelope, user.id, now, invite.householdId, user.id),
    ),
  ]);
  if (results[0].meta.changes === 0) return c.json({ error: "used" }, 410);
  return c.json({ householdId: invite.householdId, role: invite.role }, 201);
});

// --- Sincronización -----------------------------------------------------------------------

function householdLog(env: Env, householdId: string) {
  return env.HOUSEHOLD.get(env.HOUSEHOLD.idFromName(householdId));
}

/**
 * Subir cambios. El servidor no los lee, pero exige: ser miembro, poder escribir en ese nivel
 * (un chico no escribe en "Adultos"), la versión vigente de la clave y la firma de quien tiene la
 * sesión. Con una cookie robada sola no alcanza: sin la clave privada de la persona, no se escribe.
 */
app.post("/households/:id/ops", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if (!uuid.safeParse(householdId).success) return c.json({ error: "not-found" }, 404);
  const member = await membership(c.env, householdId, user.id);
  if (!member) return c.json({ error: "not-found" }, 404);
  await touchHousehold(c.env, householdId);
  if (Number(c.req.header("Content-Length") ?? 0) > SYNC_LIMITS.pushBytes) return c.json({ error: "too-large" }, 413);
  const input = await parse(c, pushInput);
  if (!input) return c.json({ error: "invalid" }, 400);

  const [household, keys] = await Promise.all([
    c.env.DB.prepare(
      "select h.family_key_version as family, h.adults_key_version as adults, coalesce(p.status, 'active') as planStatus from households h left join household_plans p on p.household_id = h.id where h.id = ?",
    )
      .bind(householdId)
      .first<{ family: number; adults: number; planStatus: string }>(),
    c.env.DB.prepare("select sign_public_key as signPublicKey from user_keys where user_id = ?").bind(user.id).first<{ signPublicKey: string }>(),
  ]);
  if (!household || !keys) return c.json({ error: "not-found" }, 404);
  // Casa en pausa (plan vencido o pausado): se puede bajar todo, pero no subir.
  if (household.planStatus === "paused") return c.json({ error: "plan-paused" }, 402);
  const allowed = scopesFor(member.role);
  for (const op of input.ops) {
    if (!allowed.includes(op.scope)) return c.json({ error: "forbidden-scope" }, 403);
    const current = op.scope === "private" ? 1 : household[op.scope];
    if (op.keyVersion !== current) return c.json({ error: "stale-key" }, 409);
  }
  const signed = await Promise.all(input.ops.map((op) => verifySignature(keys.signPublicKey, opSigningData(householdId, op, user.id), op.sig)));
  if (signed.some((ok) => !ok)) return c.json({ error: "bad-signature" }, 400);

  try {
    return c.json(await householdLog(c.env, householdId).push(user.id, input.ops));
  } catch (error) {
    if (error instanceof Error && error.message === OP_CONFLICT) return c.json({ error: "conflict" }, 409);
    throw error;
  }
});

// --- Fotos (cifradas en el dispositivo) ------------------------------------------------------
//
// Cada foto tiene su propia clave, que viaja DENTRO del registro sincronizado (cifrado con el nivel
// de su receta). Acá solo llegan bytes cifrados: el proveedor no puede ver ninguna foto. Se pide
// ser miembro de la casa para subir, bajar o borrar.

const PHOTO_VARIANTS = ["full", "thumb"] as const;
const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
const photoKey = (householdId: string, photoId: string, variant: string) => `households/${householdId}/photos/${photoId}/${variant}`;

function photoStorageFailure(c: Context<AppEnv>, error: unknown) {
  if (error instanceof PhotoStorageError) {
    console.error(`[photo-storage] ${error.operation} failed with status ${error.status}`);
    if (error.status === 413) return c.json({ error: "too-large" }, 413);
    if (error.status === 429) return c.json({ error: "storage-rate-limited" }, 429);
    if (error.status === 402 || error.status === 507) return c.json({ error: "storage-quota" }, 507);
  } else {
    console.error("[photo-storage] unexpected failure", error);
  }
  return c.json({ error: "storage-unavailable" }, 503);
}

/** Miembro de la casa y foto bien nombrada; si no, la respuesta de error. */
async function photoAccess(c: Context<AppEnv>) {
  const user = await requireUser(c);
  if (!user) return { error: c.json({ error: "unauthorized" }, 401) };
  const { id: householdId, photoId, variant } = c.req.param() as { id: string; photoId: string; variant?: string };
  if (!uuid.safeParse(householdId).success || !uuid.safeParse(photoId).success || (variant && !(PHOTO_VARIANTS as readonly string[]).includes(variant))) {
    return { error: c.json({ error: "not-found" }, 404) };
  }
  const member = await membership(c.env, householdId, user.id);
  if (!member) return { error: c.json({ error: "not-found" }, 404) };
  await touchHousehold(c.env, householdId);
  return { user, member, householdId, photoId, variant: variant ?? "full" };
}

app.put("/households/:id/photos/:photoId/:variant", async (c) => {
  const access = await photoAccess(c);
  if ("error" in access) return access.error;
  const { member, householdId, photoId, variant } = access;
  if (member.role === "kid") return c.json({ error: "forbidden" }, 403);
  const plan = await c.env.DB.prepare("select status from household_plans where household_id = ?").bind(householdId).first<{ status: string }>();
  if (plan?.status === "paused") return c.json({ error: "plan-paused" }, 402);
  if (Number(c.req.header("Content-Length") ?? 0) > PHOTO_MAX_BYTES) return c.json({ error: "too-large" }, 413);
  const body = await c.req.arrayBuffer();
  // iv (12) + etiqueta de AES-GCM (16): menos que eso no es una foto cifrada.
  if (body.byteLength > PHOTO_MAX_BYTES) return c.json({ error: "too-large" }, 413);
  if (body.byteLength < 29) return c.json({ error: "invalid" }, 400);
  const key = photoKey(householdId, photoId, variant);
  try {
    await photoStorage(c.env).put(key, body);
    return c.json({ ok: true });
  } catch (error) {
    return photoStorageFailure(c, error);
  }
});

app.get("/households/:id/photos/:photoId/:variant", async (c) => {
  const access = await photoAccess(c);
  if ("error" in access) return access.error;
  try {
    const object = await photoStorage(c.env).get(photoKey(access.householdId, access.photoId, access.variant));
    if (!object) return c.json({ error: "not-found" }, 404);
    return new Response(object.body, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store" } });
  } catch (error) {
    return photoStorageFailure(c, error);
  }
});

/** Borrar una foto (las dos variantes): quien puede administrar recetas. */
app.delete("/households/:id/photos/:photoId", async (c) => {
  const access = await photoAccess(c);
  if ("error" in access) return access.error;
  const { member, householdId, photoId } = access;
  if (member.role === "kid") return c.json({ error: "forbidden" }, 403);
  const keys = PHOTO_VARIANTS.map((variant) => photoKey(householdId, photoId, variant));
  try {
    await photoStorage(c.env).delete(keys);
    return c.json({ ok: true });
  } catch (error) {
    return photoStorageFailure(c, error);
  }
});

/** Bajar cambios desde `since`: solo los niveles que la persona puede abrir. */
app.get("/households/:id/ops", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if (!uuid.safeParse(householdId).success) return c.json({ error: "not-found" }, 404);
  const member = await membership(c.env, householdId, user.id);
  if (!member) return c.json({ error: "not-found" }, 404);
  await touchHousehold(c.env, householdId);
  const query = pullQuery.safeParse(c.req.query());
  if (!query.success) return c.json({ error: "invalid" }, 400);
  return c.json(await householdLog(c.env, householdId).pull({ userId: user.id, adults: member.role !== "kid", ...query.data }));
});

// --- Administración (licencias y planes) -----------------------------------------------------
//
// Operador independiente: clave aleatoria + TOTP y sesión revocable. Sin proveedores externos.
// Nunca ve contenido de las casas (está cifrado igual).

const admin = new Hono<AppEnv>();
app.route("/admin/auth", operatorAuth);

admin.use("*", async (c, next) => {
  if (!operatorRequestAllowed(c.req.raw, c.env)) return c.json({ error: "not-found" }, 404);
  const email = await operatorSession(c.req.raw, c.env);
  if (!email) return c.json({ error: "not-found" }, 404);
  c.set("operatorEmail", email);
  return next();
});
admin.use("*", bodyLimit({ maxSize: 16 * 1024, onError: (c) => c.json({ error: "too-large" }, 413) }));

const LICENSE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I, O, 0, 1: no se confunden al dictarlo

/** Consulta operativa: nunca otorga privilegios a cuentas domésticas. */
admin.get("/accounts", async (c) => {
  const email = c.req.query("email")?.trim().toLowerCase();
  if (!email || email.length > 254) return c.json({ error: "invalid" }, 400);
  const result = await c.env.DB.prepare('select id, email, name, "createdAt" from "user" where lower(email) = ?').bind(email).all();
  return c.json({ accounts: result.results });
});

/** Código nuevo: "OD-XXXX-XXXX-XXXX-XXXX" (80 bits al azar). */
function newLicenseCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map((byte) => LICENSE_ALPHABET[byte % 32]).join("");
  return `OD-${chars.match(/.{4}/g)!.join("-")}`;
}

async function issueLicenses(env: Env, input: z.infer<typeof createLicensesInput>) {
  const now = Date.now();
  const expiresAt = input.expiresInDays ? now + input.expiresInDays * DAY : null;
  const licenses = Array.from({ length: input.count }, () => ({ id: crypto.randomUUID(), code: newLicenseCode() }));
  await env.DB.batch(
    await Promise.all(
      licenses.map(async ({ id, code }) =>
        env.DB.prepare(
          "insert into cloud_licenses (id, code_hash, plan, max_households, expires_at, source, external_id, note, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).bind(id, await sha256(normalizeLicenseCode(code)), input.plan, input.maxHouseholds, expiresAt, input.source, input.externalId ?? null, input.note ?? null, now),
      ),
    ),
  );
  return licenses.map(({ id, code }) => ({ id, code, plan: input.plan, expiresAt }));
}

async function audit(c: Context<AppEnv>, action: string, targetType: string, targetId: string, details?: Record<string, unknown>) {
  await c.env.DB.prepare("insert into admin_audit (id, actor_user_id, action, target_type, target_id, details, created_at) values (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), null, action, targetType, targetId, JSON.stringify({ ...details, operatorEmail: c.var.operatorEmail }), Date.now())
    .run();
}

async function setHouseholdStatus(env: Env, householdId: string, status: "active" | "paused") {
  return env.DB.prepare(
    `insert into household_plans (household_id, plan, status, updated_at) select id, 'beta', ?, ? from households where id = ?
       on conflict (household_id) do update set status = excluded.status, updated_at = excluded.updated_at`,
  )
    .bind(status, Date.now(), householdId)
    .run();
}

// --- Feedback público y operaciones privadas por CLI ---------------------------------------------

app.post("/feedback", async (c) => {
  const input = await parse(c, feedbackInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  if (await tooMany(c.env, `feedback:ip:${clientIp(c)}`, 5, DAY)) return c.json({ error: "rate-limited" }, 429);
  const user = await requireUser(c);
  const now = Date.now();
  await c.env.DB.prepare("insert into feedback (id, user_id, email, category, message, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), user?.id ?? null, user?.email ?? input.email ?? null, input.category, input.message, now, now)
    .run();
  return c.json({ ok: true }, 201);
});

const platformAdmin = new Hono<AppEnv>();

platformAdmin.get("/overview", async (c) => {
  await processInactivity(c.env);
  const nowIso = new Date().toISOString();
  const [users, households, sessions, licenses, feedback, notices, rateSignals, sessionSignals, auditRows] = await Promise.all([
    c.env.DB.prepare(`select count(*) as count from "user"`).first<{ count: number }>(),
    c.env.DB.prepare(
      `select count(*) as total,
              sum(case when coalesce(p.status, 'active') = 'active' then 1 else 0 end) as active,
              sum(case when p.status = 'paused' then 1 else 0 end) as paused
         from households h left join household_plans p on p.household_id = h.id`,
    ).first<{ total: number; active: number; paused: number }>(),
    c.env.DB.prepare(`select count(*) as count from "session" where "expiresAt" > ?`).bind(nowIso).first<{ count: number }>(),
    c.env.DB.prepare(
      `select count(*) as total,
              sum(case when status = 'active' and used < max_households and (expires_at is null or expires_at > ?) then 1 else 0 end) as available
         from cloud_licenses`,
    ).bind(Date.now()).first<{ total: number; available: number }>(),
    c.env.DB.prepare("select count(*) as count from feedback where status = 'open'").first<{ count: number }>(),
    c.env.DB.prepare("select count(*) as count from inactivity_notices where status = 'pending'").first<{ count: number }>(),
    c.env.DB.prepare(
      `select case
                when key like 'recovery:ip:%' then 'recovery-ip'
                when key like 'recovery:email:%' then 'recovery-email'
                when key like 'license-check:%' then 'license-check'
                when key like 'feedback:ip:%' then 'feedback'
                when key like 'password:%' then 'password'
                else 'other'
              end as type,
              count(*) as sources,
              max(count) as maxCount
         from attempts where window_start >= ? and count >= 5 group by type order by maxCount desc`,
    ).bind(Date.now() - DAY).all<{ type: string; sources: number; maxCount: number }>(),
    c.env.DB.prepare(
      `select u.id as userId, u.email, count(s.id) as sessions
         from "user" u join "session" s on s."userId" = u.id and s."expiresAt" > ?
        group by u.id, u.email having count(s.id) > 5 order by sessions desc`,
    ).bind(nowIso).all<{ userId: string; email: string; sessions: number }>(),
    c.env.DB.prepare(
      `select a.action, a.target_type as targetType, a.target_id as targetId, a.created_at as createdAt, coalesce(json_extract(a.details, '$.operatorEmail'), u.email) as actorEmail
         from admin_audit a left join "user" u on u.id = a.actor_user_id order by a.created_at desc limit 20`,
    ).all(),
  ]);
  return c.json({
    metrics: {
      users: users?.count ?? 0,
      households: households?.total ?? 0,
      activeHouseholds: households?.active ?? 0,
      pausedHouseholds: households?.paused ?? 0,
      activeSessions: sessions?.count ?? 0,
      licenses: licenses?.total ?? 0,
      availableLicenses: licenses?.available ?? 0,
      openFeedback: feedback?.count ?? 0,
      pendingNotices: notices?.count ?? 0,
    },
    risks: [...rateSignals.results, ...sessionSignals.results.map((signal) => ({ type: "many-sessions", ...signal }))],
    credentials: {
      operatorConfigured: operatorConfigured(c.env),
      supabaseConfigured: Boolean(c.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    recentAudit: auditRows.results,
  });
});

platformAdmin.get("/users", async (c) => {
  const rows = await c.env.DB.prepare(
    `select u.id, u.name, u.email, u."createdAt" as createdAt,
            count(distinct m.household_id) as households,
            count(distinct case when s."expiresAt" > ? then s.id end) as activeSessions,
            max(s."updatedAt") as lastSessionAt
       from "user" u
       left join memberships m on m.user_id = u.id
       left join "session" s on s."userId" = u.id
      group by u.id, u.name, u.email, u."createdAt"
      order by u."createdAt" desc`,
  )
    .bind(new Date().toISOString())
    .all();
  return c.json({ users: rows.results });
});

platformAdmin.get("/households", async (c) => {
  const rows = await c.env.DB.prepare(
    `select h.id, h.created_at as createdAt, coalesce(h.last_activity_at, h.created_at) as lastActivityAt,
            coalesce(p.plan, 'beta') as plan, coalesce(p.status, 'active') as status,
            (select count(*) from memberships m where m.household_id = h.id) as members,
            l.note as licenseNote,
            case when coalesce(p.status, 'active') = 'paused' and coalesce(h.last_activity_at, h.created_at) <= ? then 1 else 0 end as deletionEligible
       from households h
       left join household_plans p on p.household_id = h.id
       left join cloud_licenses l on l.id = p.license_id
      order by coalesce(h.last_activity_at, h.created_at) asc`,
  )
    .bind(inactiveBefore(Date.now()))
    .all();
  return c.json({ households: rows.results });
});

platformAdmin.get("/licenses", async (c) => {
  const rows = await c.env.DB.prepare(
    "select id, plan, max_households as maxHouseholds, used, status, expires_at as expiresAt, source, note, created_at as createdAt from cloud_licenses order by created_at desc",
  ).all();
  return c.json({ licenses: rows.results });
});

platformAdmin.post("/licenses", async (c) => {
  const input = await parse(c, createLicensesInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  const licenses = await issueLicenses(c.env, input);
  await audit(c, "licenses.create", "license", licenses.map((license) => license.id).join(","), { count: licenses.length });
  return c.json({ licenses }, 201);
});

platformAdmin.post("/licenses/:id/revoke", async (c) => {
  const id = c.req.param("id");
  const result = await c.env.DB.prepare("update cloud_licenses set status = 'revoked' where id = ?").bind(id).run();
  if (!result.meta.changes) return c.json({ error: "not-found" }, 404);
  await audit(c, "license.revoke", "license", id);
  return c.json({ ok: true });
});

for (const [action, status] of [
  ["pause", "paused"],
  ["resume", "active"],
] as const) {
  platformAdmin.post(`/households/:id/${action}`, async (c) => {
    const id = c.req.param("id");
    const result = await setHouseholdStatus(c.env, id, status);
    if (!result.meta.changes) return c.json({ error: "not-found" }, 404);
    await audit(c, `household.${action}`, "household", id);
    return c.json({ ok: true, status });
  });
}

platformAdmin.delete("/households/:id", async (c) => {
  const id = c.req.param("id");
  const input = await parse(c, deleteHouseholdInput);
  if (!input || input.confirm !== id) return c.json({ error: "confirmation-required" }, 400);
  const eligible = await c.env.DB.prepare(
    `select h.id from households h join household_plans p on p.household_id = h.id
      where h.id = ? and p.status = 'paused' and coalesce(h.last_activity_at, h.created_at) <= ?`,
  )
    .bind(id, inactiveBefore(Date.now()))
    .first();
  if (!eligible) return c.json({ error: "not-eligible" }, 409);
  try {
    await photoStorage(c.env).deletePrefix(`households/${id}/photos`);
    await householdLog(c.env, id).purge();
  } catch (error) {
    return photoStorageFailure(c, error);
  }
  const result = await c.env.DB.prepare("delete from households where id = ?").bind(id).run();
  if (!result.meta.changes) return c.json({ error: "not-found" }, 404);
  await audit(c, "household.delete", "household", id);
  return c.json({ ok: true });
});

platformAdmin.get("/feedback", async (c) => {
  const rows = await c.env.DB.prepare(
    "select id, email, category, message, status, created_at as createdAt, updated_at as updatedAt from feedback order by created_at desc limit 200",
  ).all();
  return c.json({ feedback: rows.results });
});

platformAdmin.patch("/feedback/:id", async (c) => {
  const input = await parse(c, feedbackStatusInput);
  if (!input) return c.json({ error: "invalid" }, 400);
  const id = c.req.param("id");
  const result = await c.env.DB.prepare("update feedback set status = ?, updated_at = ? where id = ?").bind(input.status, Date.now(), id).run();
  if (!result.meta.changes) return c.json({ error: "not-found" }, 404);
  await audit(c, "feedback.status", "feedback", id, { status: input.status });
  return c.json({ ok: true });
});

platformAdmin.get("/notices", async (c) => {
  await processInactivity(c.env);
  const rows = await c.env.DB.prepare(
    `select n.household_id as householdId, n.days_before_pause as daysBeforePause, n.due_at as dueAt, n.status, n.created_at as createdAt,
            group_concat(u.email) as memberEmails
       from inactivity_notices n
       join memberships m on m.household_id = n.household_id
       join "user" u on u.id = m.user_id
      group by n.household_id, n.days_before_pause, n.due_at, n.status, n.created_at
      order by case n.status when 'pending' then 0 else 1 end, n.due_at`,
  ).all();
  return c.json({ notices: rows.results });
});

platformAdmin.patch("/notices/:householdId/:days", async (c) => {
  const input = await parse(c, inactivityNoticeStatusInput);
  const days = Number(c.req.param("days"));
  if (!input || !INACTIVITY_NOTICE_DAYS.includes(days as (typeof INACTIVITY_NOTICE_DAYS)[number])) return c.json({ error: "invalid" }, 400);
  const householdId = c.req.param("householdId");
  const result = await c.env.DB.prepare("update inactivity_notices set status = ?, updated_at = ? where household_id = ? and days_before_pause = ?")
    .bind(input.status, Date.now(), householdId, days)
    .run();
  if (!result.meta.changes) return c.json({ error: "not-found" }, 404);
  await audit(c, "notice.status", "household", householdId, { days, status: input.status });
  return c.json({ ok: true });
});

admin.route("/platform", platformAdmin);
app.route("/admin", admin);

app.notFound((c) => c.json({ error: "not-found" }, 404));
app.onError((error, c) => {
  console.error(error);
  return c.json({ error: "server-error" }, 500);
});

/**
 * Avisos en tiempo real (WebSocket). Va por fuera de Hono: la respuesta 101 lleva el socket y no
 * se puede copiar para sumarle encabezados. Los navegadores mandan la cookie también a sockets de
 * otros sitios, así que el origen se exige acá igual que en lo que cambia datos.
 */
async function live(request: Request, env: Env, householdId: string) {
  const json = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  const origin = request.headers.get("Origin");
  if (!origin || !allowedOrigins(env).includes(origin)) return json("forbidden-origin", 403);
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json("expected-websocket", 426);
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  if (!session) return json("unauthorized", 401);
  if (!uuid.safeParse(householdId).success || !(await membership(env, householdId, session.user.id))) return json("not-found", 404);
  // Sobrescribir también encabezados que pudiera enviar un cliente: solo vale la sesión verificada.
  const headers = new Headers(request.headers);
  headers.set("X-OpenDomus-Household", householdId);
  headers.set("X-OpenDomus-User", session.user.id);
  headers.set("X-OpenDomus-Session", session.session.id);
  return householdLog(env, householdId).fetch(new Request(request, { headers }));
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return operatorPage(request, env.ASSETS);
    const socket = url.pathname.match(/^\/api\/households\/([^/]+)\/live$/);
    if (socket) return live(request, env, socket[1]);
    // `run_worker_first` incluye /admin y /api/*; lo demás son archivos de la app.
    if (url.pathname.startsWith("/api/")) return app.fetch(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      processInactivity(env)
        .then((result) => console.log(`[inactivity] notices=${result.noticesQueued} paused=${result.householdsPaused}`))
        .catch((error) => console.error("[inactivity] failed", error)),
    );
  },
} satisfies ExportedHandler<Env>;
