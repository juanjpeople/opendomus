/**
 * Servicio del calendario: ÚNICO punto que escribe eventos. Verifica permisos, que los
 * participantes existan, y deja todo en el historial.
 */
import { recordActivity, setActivityPrivacy } from "@/features/activity/service";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { createId } from "@/lib/id";
import { parseEvent, type EventInput } from "./domain";

/** Descarta participantes que ya no son miembros (ej. se borró un perfil). */
async function existingParticipants(ids: string[]) {
  const members = await db.members.bulkGet(ids);
  return ids.filter((_, index) => members[index]);
}

export async function createEvent(actor: Actor | null, input: EventInput) {
  assertCan(actor, "calendar.manage");
  const data = parseEvent(input);
  const now = Date.now();
  const id = createId();
  await db.transaction("rw", db.events, db.members, db.activity, async () => {
    const participantIds = await existingParticipants(data.participantIds);
    await db.events.add({ ...data, participantIds, id, createdBy: actor.id, createdAt: now, updatedAt: now });
    await recordActivity(actor, { module: "calendar", action: "create", entityId: id, entityName: data.title, privacy: data.privacy, createdBy: actor.id });
  });
  return id;
}

export async function updateEvent(actor: Actor | null, id: string, input: EventInput) {
  assertCan(actor, "calendar.manage");
  const data = parseEvent(input);
  await db.transaction("rw", db.events, db.members, db.activity, async () => {
    const event = await db.events.get(id);
    if (!event) throw new NotFoundError("errors.notFound.event");
    await setActivityPrivacy("calendar", id, data.privacy, event.createdBy);
    const participantIds = await existingParticipants(data.participantIds);
    await db.events.update(id, { ...data, participantIds, updatedAt: Date.now() });
    await recordActivity(actor, { module: "calendar", action: "update", entityId: id, entityName: data.title, privacy: data.privacy, createdBy: event.createdBy });
  });
}

export async function deleteEvent(actor: Actor | null, id: string) {
  assertCan(actor, "calendar.manage");
  await db.transaction("rw", db.events, db.activity, async () => {
    const event = await db.events.get(id);
    if (!event) return;
    await setActivityPrivacy("calendar", id, event.privacy ?? "family", event.createdBy);
    await db.events.delete(id);
    await recordActivity(actor, { module: "calendar", action: "delete", entityId: id, entityName: event.title, privacy: event.privacy ?? "family", createdBy: event.createdBy });
  });
}
