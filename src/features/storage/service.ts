/**
 * Servicio de lugares: ÚNICO punto que escribe recintos y contenedores.
 * Verifica permisos, valida y deja todo en el historial dentro de la misma transacción.
 * Borrar nunca arrastra contenido: un recinto con contenedores o un contenedor con
 * productos no se puede borrar (primero se vacía o se mueve), así nada se pierde por accidente.
 */
import { recordActivity } from "@/features/activity/service";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { createId } from "@/lib/id";
import { CONTENT_LIMITS, generateContainerCode, parseContainer, parseContentText, parseSpace, STORAGE_LIMITS, type NewContainer, type NewSpace } from "./domain";
import { depthOf, descendantIds, subtreeHeight } from "./tree";

export async function createSpace(actor: Actor | null, input: NewSpace) {
  assertCan(actor, "storage.manage");
  const data = parseSpace(input);
  const now = Date.now();
  const id = createId();
  await db.transaction("rw", db.spaces, db.activity, async () => {
    await db.spaces.add({ ...data, id, createdAt: now, updatedAt: now });
    await recordActivity(actor, { module: "storage", action: "create", entityId: id, entityName: data.name });
  });
  return id;
}

export async function updateSpace(actor: Actor | null, id: string, input: NewSpace) {
  assertCan(actor, "storage.manage");
  const data = parseSpace(input);
  await db.transaction("rw", db.spaces, db.activity, async () => {
    if (!(await db.spaces.get(id))) throw new NotFoundError("errors.notFound.space");
    await db.spaces.update(id, { ...data, updatedAt: Date.now() });
    await recordActivity(actor, { module: "storage", action: "update", entityId: id, entityName: data.name });
  });
}

export async function deleteSpace(actor: Actor | null, id: string) {
  assertCan(actor, "storage.manage");
  await db.transaction("rw", db.spaces, db.containers, db.activity, async () => {
    const space = await db.spaces.get(id);
    if (!space) return;
    if ((await db.containers.where("spaceId").equals(id).count()) > 0) throw new ValidationError("errors.storage.spaceNotEmpty");
    await db.spaces.delete(id);
    await recordActivity(actor, { module: "storage", action: "delete", entityId: id, entityName: space.name });
  });
}

/** Código único: el índice `&code` lo garantiza; si choca (muy improbable), se reintenta. */
async function uniqueCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateContainerCode();
    if (!(await db.containers.where("code").equals(code).first())) return code;
  }
  throw new ValidationError("errors.storage.codeExhausted");
}

/**
 * Resuelve dónde queda un contenedor: dentro de `parentId` (hereda su recinto) o directo en `spaceId`.
 * Valida que el padre exista, que no se formen ciclos y que no se pase del máximo de niveles.
 */
async function resolvePlacement(data: NewContainer, movingId?: string): Promise<{ spaceId: string; parentId?: string }> {
  if (!data.parentId) {
    if (!(await db.spaces.get(data.spaceId))) throw new NotFoundError("errors.notFound.space");
    return { spaceId: data.spaceId, parentId: undefined };
  }
  const parent = await db.containers.get(data.parentId);
  if (!parent) throw new NotFoundError("errors.notFound.container");

  // A escala de una casa (decenas de contenedores) leer todos es trivial y evita casos borde.
  const all = await db.containers.toArray();
  const byId = new Map(all.map((container) => [container.id, container]));

  if (movingId && (data.parentId === movingId || descendantIds(movingId, all).has(data.parentId))) {
    throw new ValidationError("errors.storage.cycle");
  }
  // Nivel del padre + lo que ocupa el contenedor que se mueve (con sus compartimentos).
  const height = movingId ? subtreeHeight(movingId, all) : 1;
  if (depthOf(parent.id, byId) + height > STORAGE_LIMITS.maxDepth) {
    throw new ValidationError("errors.storage.tooDeep", { max: STORAGE_LIMITS.maxDepth });
  }
  return { spaceId: parent.spaceId, parentId: parent.id };
}

export async function createContainer(actor: Actor | null, input: NewContainer) {
  assertCan(actor, "storage.manage");
  const data = parseContainer(input);
  const now = Date.now();
  const id = createId();
  await db.transaction("rw", db.spaces, db.containers, db.activity, async () => {
    const placement = await resolvePlacement(data);
    const code = await uniqueCode();
    await db.containers.add({ ...data, ...placement, id, code, createdAt: now, updatedAt: now });
    await recordActivity(actor, { module: "storage", action: "create", entityId: id, entityName: data.name, containerId: id, place: data.name });
  });
  return id;
}

export async function updateContainer(actor: Actor | null, id: string, input: NewContainer) {
  assertCan(actor, "storage.manage");
  const data = parseContainer(input);
  await db.transaction("rw", db.spaces, db.containers, db.activity, async () => {
    const container = await db.containers.get(id);
    if (!container) throw new NotFoundError("errors.notFound.container");
    const placement = await resolvePlacement(data, id);
    await db.containers.update(id, { ...data, ...placement, updatedAt: Date.now() });

    // Si cambió de recinto, sus compartimentos se mudan con él.
    if (placement.spaceId !== container.spaceId) {
      const all = await db.containers.where("spaceId").equals(container.spaceId).toArray();
      const descendants = [...descendantIds(id, all)];
      await Promise.all(descendants.map((childId) => db.containers.update(childId, { spaceId: placement.spaceId })));
    }

    const moved = placement.spaceId !== container.spaceId || placement.parentId !== container.parentId;
    await recordActivity(actor, { module: "storage", action: moved ? "move" : "update", entityId: id, entityName: data.name, containerId: id, place: data.name });
  });
}

export async function deleteContainer(actor: Actor | null, id: string) {
  assertCan(actor, "storage.manage");
  await db.transaction("rw", [db.containers, db.inventory, db.containerContents, db.photos, db.activity], async () => {
    const container = await db.containers.get(id);
    if (!container) return;
    if ((await db.containers.where("parentId").equals(id).count()) > 0) throw new ValidationError("errors.storage.containerHasChildren");
    if ((await db.inventory.where("containerId").equals(id).count()) > 0) throw new ValidationError("errors.storage.containerNotEmpty");
    if ((await db.containerContents.where("containerId").equals(id).count()) > 0 ||
        (await db.photos.where("[ownerType+ownerId]").equals(["container", id]).count()) > 0) throw new ValidationError("errors.storage.containerHasContent");
    await db.containers.delete(id);
    await recordActivity(actor, { module: "storage", action: "delete", entityId: id, entityName: container.name, place: container.name });
  });
}

/** Cada anotación tiene identidad propia: agregar una nunca reemplaza la lista de otro dispositivo. */
export async function saveContainerContent(actor: Actor | null, containerId: string, input: string, id?: string) {
  assertCan(actor, "storage.manage");
  const text = parseContentText(input);
  const entryId = id ?? createId();
  await db.transaction("rw", db.containers, db.containerContents, db.activity, async () => {
    const container = await db.containers.get(containerId);
    if (!container) throw new NotFoundError("errors.notFound.container");
    const existing = id ? await db.containerContents.get(id) : undefined;
    if (id && (!existing || existing.containerId !== containerId)) throw new NotFoundError("errors.notFound.containerContent");
    if (!id && await db.containerContents.where("containerId").equals(containerId).count() >= CONTENT_LIMITS.maxPerContainer) {
      throw new ValidationError("errors.storage.tooMuchContent", { max: CONTENT_LIMITS.maxPerContainer });
    }
    const now = Date.now();
    await db.containerContents.put({ ...existing, id: entryId, containerId, text, createdBy: existing?.createdBy ?? actor.id, createdAt: existing?.createdAt ?? now, updatedAt: now });
    await recordActivity(actor, { module: "storage", action: "update", entityId: containerId, entityName: container.name, containerId, place: container.name });
  });
  return entryId;
}

export async function deleteContainerContent(actor: Actor | null, id: string) {
  assertCan(actor, "storage.manage");
  await db.transaction("rw", db.containers, db.containerContents, db.activity, async () => {
    const entry = await db.containerContents.get(id);
    if (!entry) return;
    const container = await db.containers.get(entry.containerId);
    await db.containerContents.delete(id);
    if (container) await recordActivity(actor, { module: "storage", action: "update", entityId: container.id, entityName: container.name, containerId: container.id, place: container.name });
  });
}

/** Pegar una lista es una única operación: se valida toda antes de escribir. */
export async function addContainerContents(actor: Actor | null, containerId: string, input: string) {
  assertCan(actor, "storage.manage");
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map(parseContentText);
  if (!lines.length) throw new ValidationError("errors.validation.nameRequired");
  const unique = [...new Set(lines)];
  return db.transaction("rw", db.containers, db.containerContents, db.activity, async () => {
    const container = await db.containers.get(containerId);
    if (!container) throw new NotFoundError("errors.notFound.container");
    const existing = await db.containerContents.where("containerId").equals(containerId).toArray();
    const known = new Set(existing.map((entry) => entry.text));
    const additions = unique.filter((text) => !known.has(text));
    if (existing.length + additions.length > CONTENT_LIMITS.maxPerContainer) throw new ValidationError("errors.storage.tooMuchContent", { max: CONTENT_LIMITS.maxPerContainer });
    const now = Date.now();
    await db.containerContents.bulkAdd(additions.map((text) => ({ id: createId(), containerId, text, createdBy: actor.id, createdAt: now, updatedAt: now })));
    if (additions.length) await recordActivity(actor, { module: "storage", action: "update", entityId: containerId, entityName: container.name, containerId, place: container.name });
    return additions.length;
  });
}
