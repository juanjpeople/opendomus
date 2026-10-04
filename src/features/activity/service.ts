/**
 * Registro del historial. `recordActivity` es SOLO para otros servicios y se llama dentro de
 * su transacción (que debe incluir `db.activity`): si el cambio falla, tampoco queda registrado.
 */
import Dexie from "dexie";
import type { Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { createId } from "@/lib/id";
import { untracked } from "@/lib/sync/middleware";
import type { Privacy } from "@/lib/sync/scope";
import { ACTIVITY_LIMITS, type ActivityEntry, type ActivityModule } from "./domain";

type NewActivity = Omit<ActivityEntry, "id" | "at" | "actorId" | "actorName">;

/** Devuelve el id de la entrada (la nueva o la agrupada), o `null` si el cambio se anuló. */
export async function recordActivity(actor: Actor, entry: NewActivity): Promise<string | null> {
  const now = Date.now();

  // Clics seguidos en +/- sobre el mismo ítem: se actualiza la última entrada en vez de sumar una por clic.
  if (entry.action === "adjust") {
    const last = await db.activity
      .where("[entityId+at]")
      .between([entry.entityId, Dexie.minKey], [entry.entityId, Dexie.maxKey])
      .last();
    if (last?.action === "adjust" && last.undoneAt === undefined && last.actorId === actor.id && now - last.at < ACTIVITY_LIMITS.coalesceMs) {
      // Si volvió al valor inicial (sumó y restó), la acción se anula: no queda nada que contar.
      if (last.from === entry.to) {
        await db.activity.delete(last.id);
        return null;
      }

      await db.activity.update(last.id, { to: entry.to, at: now });
      return last.id;
    }
  }

  const id = createId();
  await db.activity.add({ ...entry, id, at: now, actorId: actor.id, actorName: actor.name });
  return id;
}

/** Sella o cambia el nivel del historial heredado antes de cambiar o borrar su padre. */
export async function setActivityPrivacy(module: ActivityModule, entityId: string, privacy: Privacy, createdBy: string) {
  const changes = { privacy, createdBy };
  await db.activity
    .where("[entityId+at]")
    .between([entityId, Dexie.minKey], [entityId, Dexie.maxKey])
    .filter((entry) => entry.module === module)
    .modify(changes);
  if (module === "lists") await db.activity.where("listId").equals(entityId).modify(changes);
}

/** Mantiene el historial acotado borrando lo más viejo. Barato: solo cuenta salvo que haya excedente. */
export async function pruneActivity() {
  const excess = (await db.activity.count()) - ACTIVITY_LIMITS.maxEntries;
  if (excess <= 0) return;
  await db.transaction("rw", db.activity, async (tx) => {
    // Limpieza de ESTE dispositivo: con la casa en la nube no se sube (cada uno recorta lo suyo).
    untracked(tx);
    const oldest = await db.activity.orderBy("at").limit(excess).primaryKeys();
    await db.activity.bulkDelete(oldest);
  });
}
