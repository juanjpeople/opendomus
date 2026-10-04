/**
 * Servicio de miembros: ÚNICO punto que escribe miembros y su seguridad.
 * Invariantes: siempre queda al menos un administrador y nadie se borra a sí mismo.
 * La seguridad (PIN, biometría) la gestiona cada uno sobre su perfil; un admin solo puede
 * QUITARLA (resetear un PIN olvidado), nunca poner un PIN en nombre de otro.
 */
import { recordActivity } from "@/features/activity/service";
import { APPEARANCE_COLORS } from "@/lib/appearance";
import { assertCan, can, type Actor, type Role } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { NotFoundError, PermissionError, ValidationError } from "@/lib/errors";
import { createId } from "@/lib/id";
import { isValidPin, MEMBER_LIMITS, parseMember, type BiometricCredential, type MemberInput } from "./domain";
import { hashPin } from "./security";

async function adminCount() {
  return (await db.members.toArray()).filter((member) => member.role === "admin").length;
}

export async function createMember(actor: Actor | null, input: MemberInput) {
  assertCan(actor, "members.manage");
  const data = parseMember(input);
  const now = Date.now();
  const id = createId();
  await db.transaction("rw", db.members, db.activity, async () => {
    await db.members.add({ ...data, id, createdAt: now, updatedAt: now });
    await recordActivity(actor, { module: "members", action: "create", entityId: id, entityName: data.name });
  });
  return id;
}

export async function updateMember(actor: Actor | null, id: string, input: MemberInput) {
  assertCan(actor, "members.manage");
  const data = parseMember(input);
  await db.transaction("rw", db.members, db.activity, async () => {
    const member = await db.members.get(id);
    if (!member) throw new NotFoundError("errors.notFound.member");
    if (member.role === "admin" && data.role !== "admin" && (await adminCount()) <= 1) throw new ValidationError("errors.members.lastAdmin");
    await db.members.update(id, { ...data, updatedAt: Date.now() });
    await recordActivity(actor, { module: "members", action: "update", entityId: id, entityName: data.name });
  });
}

export async function deleteMember(actor: Actor | null, id: string) {
  assertCan(actor, "members.manage");
  if (actor.id === id) throw new ValidationError("errors.members.deleteSelf");
  await db.transaction("rw", db.members, db.events, db.activity, async () => {
    const member = await db.members.get(id);
    if (!member) return;
    if (member.role === "admin" && (await adminCount()) <= 1) throw new ValidationError("errors.members.lastAdmin");
    await db.members.delete(id);
    // Deja de figurar como participante de los eventos.
    await db.events.toCollection().modify((event) => {
      event.participantIds = event.participantIds.filter((participantId) => participantId !== id);
    });
    await recordActivity(actor, { module: "members", action: "delete", entityId: id, entityName: member.name });
  });
}

/**
 * Ata un perfil a una cuenta de la nube, o crea el perfil de quien se une a la casa. Sin chequeo
 * de permisos: lo hace cada persona sobre sí misma (puede ser un chico). Cada dispositivo verifica
 * al recibirlo que solo tome un perfil libre de su mismo rol (`src/lib/sync/policy.ts`).
 */
export async function linkMemberToAccount(input: { memberId?: string; userId: string; name: string; role: Role }): Promise<string> {
  const now = Date.now();
  const name = input.name.trim().slice(0, MEMBER_LIMITS.nameMaxLength) || input.role;
  return db.transaction("rw", db.members, db.activity, async () => {
    const existing = input.memberId ? await db.members.get(input.memberId) : undefined;
    if (existing) {
      await db.members.update(existing.id, { userId: input.userId, name, role: input.role, updatedAt: now });
      return existing.id;
    }
    const members = await db.members.toArray();
    const used = new Set(members.map((member) => member.color));
    const color = APPEARANCE_COLORS.find((candidate) => !used.has(candidate)) ?? "cyan";
    const id = createId();
    await db.members.add({ id, name, role: input.role, color, userId: input.userId, createdAt: now, updatedAt: now });
    await recordActivity({ id, name, role: input.role }, { module: "members", action: "create", entityId: id, entityName: name });
    return id;
  });
}

/** Alguien dejó la casa: su perfil queda (con su historial) pero ya no está atado a una cuenta. */
export async function unlinkAccount(actor: Actor | null, userId: string) {
  assertCan(actor, "members.manage");
  await db.members
    .where("userId")
    .equals(userId)
    .modify((member) => {
      delete member.userId;
      member.updatedAt = Date.now();
    });
}

/** Un admin cambió el rol de una cuenta en la nube: su perfil en la casa lo refleja. */
export async function setAccountRole(actor: Actor | null, userId: string, role: Role) {
  assertCan(actor, "members.manage");
  await db.members.where("userId").equals(userId).modify({ role, updatedAt: Date.now() });
}

// --- Seguridad del perfil ---------------------------------------------------------

/** Solo el dueño del perfil puede poner o cambiar su PIN. */
export async function setPin(actor: Actor | null, memberId: string, pin: string) {
  if (!actor || actor.id !== memberId) throw new PermissionError("members.manage");
  if (!isValidPin(pin)) throw new ValidationError("errors.members.pinInvalid");
  const hashed = await hashPin(pin);
  await db.members.update(memberId, { pin: hashed, updatedAt: Date.now() });
}

/** El dueño o un admin (para resetear un PIN olvidado). */
export async function removePin(actor: Actor | null, memberId: string) {
  if (!actor || (actor.id !== memberId && !can(actor, "members.manage"))) throw new PermissionError("members.manage");
  await db.members.update(memberId, { pin: undefined, updatedAt: Date.now() });
}

export async function addCredential(actor: Actor | null, memberId: string, credential: BiometricCredential) {
  if (!actor || actor.id !== memberId) throw new PermissionError("members.manage");
  await db.transaction("rw", db.members, async () => {
    const member = await db.members.get(memberId);
    if (!member) throw new NotFoundError("errors.notFound.member");
    await db.members.update(memberId, { credentials: [...(member.credentials ?? []), credential], updatedAt: Date.now() });
  });
}

export async function removeCredential(actor: Actor | null, memberId: string, credentialId: string) {
  if (!actor || (actor.id !== memberId && !can(actor, "members.manage"))) throw new PermissionError("members.manage");
  await db.transaction("rw", db.members, async () => {
    const member = await db.members.get(memberId);
    if (!member) return;
    await db.members.update(memberId, {
      credentials: (member.credentials ?? []).filter((credential) => credential.id !== credentialId),
      updatedAt: Date.now(),
    });
  });
}
