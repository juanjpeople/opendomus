/**
 * Registro del historial. `recordActivity` es SOLO para otros servicios y se llama dentro de
 * su transacción (que debe incluir `db.activity`): si el cambio falla, tampoco queda registrado.
 */
import Dexie from "dexie";
import type { Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { createId } from "@/lib/id";
import { ACTIVITY_LIMITS, type ActivityEntry } from "./domain";

type NewActivity = Omit<ActivityEntry, "id" | "at" | "actorId" | "actorName">;

export async function recordActivity(actor: Actor, entry: NewActivity) {
  const now = Date.now();

  // Clics seguidos en +/- sobre el mismo ítem: se actualiza la última entrada en vez de sumar una por clic.
  if (entry.action === "adjust") {
    const last = await db.activity
      .where("[entityId+at]")
      .between([entry.entityId, Dexie.minKey], [entry.entityId, Dexie.maxKey])
      .last();
    if (last?.action === "adjust" && last.actorId === actor.id && now - last.at < ACTIVITY_LIMITS.coalesceMs) {
      // Si volvió al valor inicial (sumó y restó), la acción se anula: no queda nada que contar.
      if (last.from === entry.to) await db.activity.delete(last.id);
      else await db.activity.update(last.id, { to: entry.to, at: now });
      return;
    }
  }

  await db.activity.add({ ...entry, id: createId(), at: now, actorId: actor.id, actorName: actor.name });
}

/** Mantiene el historial acotado borrando lo más viejo. Barato: solo cuenta salvo que haya excedente. */
export async function pruneActivity() {
  const excess = (await db.activity.count()) - ACTIVITY_LIMITS.maxEntries;
  if (excess <= 0) return;
  const oldest = await db.activity.orderBy("at").limit(excess).primaryKeys();
  await db.activity.bulkDelete(oldest);
}
