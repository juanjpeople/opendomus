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
import type { z } from "zod";
import { opSigningData, SYNC_LIMITS } from "../../src/lib/sync/protocol";
import { authOptions } from "./auth-options";
import type { AppEnv, Env, SessionUser } from "./env";
import { OP_CONFLICT } from "./sync";
import {
  acceptInviteInput,
  changeRoleInput,
  createHouseholdInput,
  createInviteInput,
  envelopeInput,
  inviteTokenInput,
  pullQuery,
  pushInput,
  userId,
  userKeysInput,
  uuid,
  type Role,
  type Scope,
} from "./validation";

export { HouseholdLog } from "./sync";

const DAY = 86_400_000;

function allowedOrigins(env: Env) {
  return [env.APP_ORIGIN, ...(env.DEV_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean)];
}

function createAuth(env: Env) {
  return betterAuth(
    authOptions(env.DB, {
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.APP_ORIGIN,
      trustedOrigins: allowedOrigins(env),
      // Hasta tener un servicio de emails, se registran en el log del Worker (`wrangler tail`).
      sendEmail: async (to, subject, text) => console.log(`[email] ${to} · ${subject}\n${text}`),
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
  return cors({ origin: dev, credentials: true, allowHeaders: ["Content-Type"], allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] })(c, next);
});

// CSRF: todo lo que cambia algo tiene que venir de la app (Origin conocido). Better Auth valida lo suyo.
app.use("*", async (c, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(c.req.method) || c.req.path.startsWith("/api/auth/")) return next();
  const origin = c.req.header("Origin");
  if (!origin || !allowedOrigins(c.env).includes(origin)) return c.json({ error: "forbidden-origin" }, 403);
  return next();
});

app.on(["GET", "POST"], "/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

app.get("/health", (c) => c.json({ ok: true }));

/** Exige sesión. */
async function requireUser(c: Context<AppEnv>): Promise<SessionUser | null> {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) return null;
  const user = { id: session.user.id, name: session.user.name, email: session.user.email };
  c.set("user", user);
  return user;
}

async function parse<T extends z.ZodTypeAny>(c: Context<AppEnv>, schema: T): Promise<z.infer<T> | null> {
  const result = schema.safeParse(await c.req.json().catch(() => null));
  return result.success ? result.data : null;
}

async function membership(env: Env, householdId: string, userId: string) {
  return env.DB.prepare("select role from memberships where household_id = ? and user_id = ?").bind(householdId, userId).first<{ role: Role }>();
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
    "insert into user_keys (user_id, kdf_version, enc_public_key, sign_public_key, private_keys, recovery_private_keys, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?) on conflict (user_id) do nothing",
  )
    .bind(user.id, input.kdfVersion, input.encPublicKey, input.signPublicKey, input.privateKeys, input.recoveryPrivateKeys, now, now)
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
    `select h.id, h.encrypted_name as encryptedName, h.family_key_version as familyKeyVersion, h.adults_key_version as adultsKeyVersion, m.role
       from memberships m join households h on h.id = m.household_id
      where m.user_id = ? order by m.joined_at`,
  )
    .bind(user.id)
    .all<{ id: string; encryptedName: string; familyKeyVersion: number; adultsKeyVersion: number; role: Role }>();
  const envelopes = await c.env.DB.prepare(
    "select household_id as householdId, scope, version, envelope from key_envelopes where recipient_user_id = ?",
  )
    .bind(user.id)
    .all<{ householdId: string; scope: Scope; version: number; envelope: string }>();
  return c.json({
    user,
    keys,
    households: households.results.map((household) => ({
      ...household,
      envelopes: envelopes.results.filter((entry) => entry.householdId === household.id).map(({ scope, version, envelope }) => ({ scope, version, envelope })),
    })),
  });
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
  // batch = una transacción en D1: o se crea todo, o nada.
  await c.env.DB.batch([
    c.env.DB.prepare("insert into households (id, encrypted_name, created_by, created_at) values (?, ?, ?, ?)").bind(input.id, input.encryptedName, user.id, now),
    c.env.DB.prepare("insert into memberships (household_id, user_id, role, joined_at) values (?, ?, 'admin', ?)").bind(input.id, user.id, now),
    ...input.envelopes.map((entry) =>
      c.env.DB.prepare("insert into key_envelopes (household_id, scope, version, recipient_user_id, envelope, created_by, created_at) values (?, ?, ?, ?, ?, ?, ?)").bind(
        input.id,
        entry.scope,
        entry.version,
        user.id,
        entry.envelope,
        user.id,
        now,
      ),
    ),
  ]);
  return c.json({ id: input.id }, 201);
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
  return c.json({ members: members.results });
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
  await c.env.DB.prepare("update memberships set role = ? where household_id = ? and user_id = ?").bind(input.role, householdId, c.req.param("userId")).run();
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
  if (Number(c.req.header("Content-Length") ?? 0) > SYNC_LIMITS.pushBytes) return c.json({ error: "too-large" }, 413);
  const input = await parse(c, pushInput);
  if (!input) return c.json({ error: "invalid" }, 400);

  const [household, keys] = await Promise.all([
    c.env.DB.prepare("select family_key_version as family, adults_key_version as adults from households where id = ?").bind(householdId).first<{ family: number; adults: number }>(),
    c.env.DB.prepare("select sign_public_key as signPublicKey from user_keys where user_id = ?").bind(user.id).first<{ signPublicKey: string }>(),
  ]);
  if (!household || !keys) return c.json({ error: "not-found" }, 404);
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

/** Bajar cambios desde `since`: solo los niveles que la persona puede abrir. */
app.get("/households/:id/ops", async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const householdId = c.req.param("id");
  if (!uuid.safeParse(householdId).success) return c.json({ error: "not-found" }, 404);
  const member = await membership(c.env, householdId, user.id);
  if (!member) return c.json({ error: "not-found" }, 404);
  const query = pullQuery.safeParse(c.req.query());
  if (!query.success) return c.json({ error: "invalid" }, 400);
  return c.json(await householdLog(c.env, householdId).pull({ userId: user.id, adults: member.role !== "kid", ...query.data }));
});

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
  return householdLog(env, householdId).fetch(request);
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const socket = url.pathname.match(/^\/api\/households\/([^/]+)\/live$/);
    if (socket) return live(request, env, socket[1]);
    // `run_worker_first` manda acá solo /api/*; lo demás son los archivos de la app.
    if (url.pathname.startsWith("/api/")) return app.fetch(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
