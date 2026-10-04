/**
 * Cuentas, casas e invitaciones en la nube, con cifrado de extremo a extremo. Todo lo sensible
 * (nombres de casas, claves de nivel) se cifra o descifra acá, en el dispositivo; a la API van
 * claves públicas y cajas cifradas.
 */
import { api } from "@/lib/cloud/api";
import { clearVault, loadIdentity, saveIdentity } from "@/lib/cloud/vault";
import {
  createIdentity,
  derivePasswordKeys,
  envelopeContext,
  importScopeKey,
  inviteSecrets,
  newScopeKey,
  open,
  openEnvelope,
  openText,
  seal,
  sealEnvelope,
  sha256,
  unlockIdentity,
  type Identity,
  type Scope,
} from "@/lib/crypto";
import type { CloudHousehold, CloudInvite, CloudMember, CloudRole, CloudUser, InvitePreview } from "./domain";

interface MeResponse {
  /** `null` si no hay sesión. */
  user: CloudUser | null;
  keys: { kdfVersion: number; encPublicKey: string; signPublicKey: string; privateKeys: string } | null;
  households: Omit<CloudHousehold, "name">[];
}

const nameContext = (householdId: string) => `household-name|${householdId}`;
const inviteContext = (inviteId: string, scope: Scope) => `invite|${inviteId}|${scope}`;

/** Niveles que puede abrir cada rol (igual que el servidor). */
export function scopesFor(role: CloudRole): Scope[] {
  return role === "kid" ? ["family", "private"] : ["family", "adults", "private"];
}

export interface CloudSession {
  user: CloudUser;
  identity: Identity;
  households: CloudHousehold[];
}

async function decryptHouseholds(me: MeResponse & { user: CloudUser }, identity: Identity): Promise<CloudHousehold[]> {
  return Promise.all(
    me.households.map(async (household) => {
      let name = "";
      try {
        const { key } = await openScopeKey(identity, me.user.id, household, "family");
        name = await openText(key, household.encryptedName, nameContext(household.id));
      } catch {
        // Un sobre que no abre (claves rotadas, error): la casa se muestra igual, sin nombre.
      }
      return { ...household, name };
    }),
  );
}

/** Abre la clave de un nivel de una casa (de su sobre, con la identidad del dispositivo). */
export async function openScopeKey(identity: Identity, userId: string, household: Pick<CloudHousehold, "id" | "envelopes" | "familyKeyVersion" | "adultsKeyVersion">, scope: Scope) {
  const version = scope === "family" ? household.familyKeyVersion : scope === "adults" ? household.adultsKeyVersion : 1;
  const entry = household.envelopes.find((envelope) => envelope.scope === scope && envelope.version === version);
  if (!entry) throw new Error("no-envelope");
  return openEnvelope(entry.envelope, identity, envelopeContext(household.id, scope, version, userId));
}

async function sessionFrom(me: MeResponse, identity: Identity): Promise<CloudSession> {
  if (!me.user) throw new Error("no-session");
  const user = me.user;
  await saveIdentity({ userId: user.id, email: user.email, identity, savedAt: Date.now() });
  return { user, identity, households: await decryptHouseholds({ ...me, user }, identity) };
}

/**
 * Crea la cuenta: deriva las claves de la contraseña, crea la identidad y el kit de recuperación,
 * y sube solo lo público y lo cifrado. Devuelve el código del kit (se muestra una sola vez).
 */
export async function signUp(input: { name: string; email: string; password: string }): Promise<{ session: CloudSession; recoveryCode: string }> {
  const keys = await derivePasswordKeys(input.email, input.password);
  await api("POST", "/auth/sign-up/email", { name: input.name.trim(), email: input.email.trim(), password: keys.authKey });
  const { identity, upload, recoveryCode } = await createIdentity(keys.encKey);
  await api("POST", "/keys", upload);
  const me = await api<MeResponse>("GET", "/me");
  return { session: await sessionFrom(me, identity), recoveryCode };
}

/** Entra en un dispositivo: la contraseña abre la identidad guardada (cifrada) en la nube. */
export async function signIn(input: { email: string; password: string }): Promise<CloudSession> {
  const keys = await derivePasswordKeys(input.email, input.password);
  await api("POST", "/auth/sign-in/email", { email: input.email.trim(), password: keys.authKey });
  const me = await api<MeResponse>("GET", "/me");
  if (!me.keys) throw new Error("no-keys");
  return sessionFrom(me, await unlockIdentity(me.keys, keys.encKey));
}

/** Al abrir la app: si hay sesión y este dispositivo tiene la identidad, entra sin pedir nada. */
export async function restoreSession(): Promise<CloudSession | null> {
  let me: MeResponse;
  try {
    me = await api<MeResponse>("GET", "/me");
  } catch {
    return null;
  }
  if (!me.user) return null;
  const stored = await loadIdentity(me.user.id);
  if (!stored) return null;
  return { user: me.user, identity: stored.identity, households: await decryptHouseholds({ ...me, user: me.user }, stored.identity) };
}

export async function signOut() {
  await api("POST", "/auth/sign-out", {}).catch(() => {});
  await clearVault();
}

export async function refreshHouseholds(session: CloudSession): Promise<CloudHousehold[]> {
  const me = await api<MeResponse>("GET", "/me");
  if (!me.user) throw new Error("no-session");
  return decryptHouseholds({ ...me, user: me.user }, session.identity);
}

/** Crea una casa: tres claves de nivel nuevas, ensobradas para quien la crea (admin). */
export async function createHousehold(session: CloudSession, name: string): Promise<string> {
  const id = crypto.randomUUID();
  const raw: Record<Scope, Uint8Array> = { family: newScopeKey(), adults: newScopeKey(), private: newScopeKey() };
  const encryptedName = await seal(await importScopeKey(raw.family), name.trim(), nameContext(id));
  const envelopes = await Promise.all(
    (Object.keys(raw) as Scope[]).map(async (scope) => ({
      scope,
      version: 1,
      envelope: await sealEnvelope(raw[scope], session.identity.encPublicKey, envelopeContext(id, scope, 1, session.user.id)),
    })),
  );
  await api("POST", "/households", { id, encryptedName, envelopes });
  return id;
}

/**
 * Invitación por link: las claves de la casa que le corresponden al rol viajan cifradas con una
 * clave que sale del secreto del link (#…). El servidor guarda solo el hash del token.
 */
export async function createInvite(session: CloudSession, household: CloudHousehold, role: CloudRole, origin: string): Promise<{ link: string; expiresAt: number }> {
  const id = crypto.randomUUID();
  const secrets = await inviteSecrets();
  const carried: Record<string, unknown> = { name: household.encryptedName };
  for (const scope of scopesFor(role).filter((scope) => scope !== "private")) {
    const { raw } = await openScopeKey(session.identity, session.user.id, household, scope);
    const version = scope === "family" ? household.familyKeyVersion : household.adultsKeyVersion;
    carried[scope] = { version, key: await seal(secrets.wrapKey, raw, inviteContext(id, scope)) };
  }
  const result = await api<{ expiresAt: number }>("POST", `/households/${household.id}/invites`, {
    id,
    role,
    tokenHash: await sha256(secrets.authToken),
    wrappedKeys: JSON.stringify(carried),
    expiresInDays: 7,
  });
  return { link: `${origin}/unirme#${id}.${secrets.secret}`, expiresAt: result.expiresAt };
}

/** Lee el link de invitación (`…/unirme#<id>.<secreto>`). */
export function parseInviteLink(hash: string): { id: string; secret: string } | null {
  const match = hash.replace(/^#/, "").match(/^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/);
  return match ? { id: match[1], secret: match[2] } : null;
}

interface PreviewResponse {
  householdId: string;
  role: CloudRole;
  wrappedKeys: string;
  inviterName: string;
  expiresAt: number;
}

/** Antes de tener cuenta: quién invita, a qué casa (se descifra acá con el secreto) y con qué rol. */
export async function previewInvite(id: string, secret: string): Promise<InvitePreview> {
  const secrets = await inviteSecrets(secret);
  const preview = await api<PreviewResponse>("POST", `/invites/${id}/preview`, { authToken: secrets.authToken });
  const carried = JSON.parse(preview.wrappedKeys) as { name: string; family: { key: string } };
  const family = await importScopeKey(await open(secrets.wrapKey, carried.family.key, inviteContext(id, "family")));
  return {
    householdId: preview.householdId,
    householdName: await openText(family, carried.name, nameContext(preview.householdId)),
    inviterName: preview.inviterName,
    role: preview.role,
    expiresAt: preview.expiresAt,
  };
}

/** Unirse: abre las claves que trae la invitación y las vuelve a ensobrar para uno mismo. */
export async function acceptInvite(session: CloudSession, id: string, secret: string): Promise<string> {
  const secrets = await inviteSecrets(secret);
  const preview = await api<PreviewResponse>("POST", `/invites/${id}/preview`, { authToken: secrets.authToken });
  const carried = JSON.parse(preview.wrappedKeys) as Partial<Record<Scope, { version: number; key: string }>>;
  const envelopes = [];
  for (const scope of scopesFor(preview.role)) {
    const entry = carried[scope];
    const raw = scope === "private" ? newScopeKey() : entry ? await open(secrets.wrapKey, entry.key, inviteContext(id, scope)) : null;
    if (!raw) continue;
    const version = scope === "private" ? 1 : entry!.version;
    envelopes.push({ scope, version, envelope: await sealEnvelope(raw, session.identity.encPublicKey, envelopeContext(preview.householdId, scope, version, session.user.id)) });
  }
  await api("POST", `/invites/${id}/accept`, { authToken: secrets.authToken, envelopes });
  return preview.householdId;
}

export function listMembers(householdId: string) {
  return api<{ members: CloudMember[] }>("GET", `/households/${householdId}/members`).then((result) => result.members);
}

export function listInvites(householdId: string) {
  return api<{ invites: CloudInvite[] }>("GET", `/households/${householdId}/invites`).then((result) => result.invites);
}

export function revokeInvite(householdId: string, inviteId: string) {
  return api("DELETE", `/households/${householdId}/invites/${inviteId}`);
}

/**
 * Cambiar el rol. Si alguien pasa a poder ver "Adultos", quien hace el cambio le entrega esa
 * clave (ensobrada para él). Bajar a "chico" sin rotar la clave queda para el hito de rotación.
 */
export async function changeRole(session: CloudSession, household: CloudHousehold, member: CloudMember, role: CloudRole) {
  await api("PATCH", `/households/${household.id}/members/${member.userId}`, { role });
  if (role !== "kid" && member.role === "kid" && member.encPublicKey) {
    const { raw } = await openScopeKey(session.identity, session.user.id, household, "adults");
    const version = household.adultsKeyVersion;
    await api("POST", `/households/${household.id}/envelopes`, {
      recipientUserId: member.userId,
      envelopes: [{ scope: "adults", version, envelope: await sealEnvelope(raw, member.encPublicKey, envelopeContext(household.id, "adults", version, member.userId)) }],
    });
  }
}
