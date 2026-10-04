"use client";

import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { usePermission } from "@/lib/auth/hooks";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { canSee, type Viewer } from "@/lib/sync/scope";
import type { ActivityEntry } from "./domain";

const EMPTY: ActivityEntry[] = [];

/**
 * Historial reactivo, de lo más nuevo a lo más viejo. Con `containerId`, solo lo de ese
 * contenedor; sin él, el de toda la casa. Sin permiso `activity.view` devuelve una lista vacía.
 */
export function useActivity({ containerId, limit = 50 }: { containerId?: string; limit?: number } = {}) {
  const allowed = usePermission("activity.view");
  const viewer = useCurrentUser();

  return useLiveQuery(
    async () => {
      if (!allowed) return EMPTY;
      const query = containerId
        ? db.activity.where("[containerId+at]").between([containerId, Dexie.minKey], [containerId, Dexie.maxKey]).reverse()
        : db.activity.orderBy("at").reverse();
      const hidden = await hiddenIds(viewer);
      return query
        .filter((entry) => canSee(viewer, entry) && !hidden.has(entry.entityId) && !(entry.listId && hidden.has(entry.listId)))
        .limit(limit)
        .toArray();
    },
    [allowed, containerId, limit, viewer?.id, viewer?.role],
  );
}

/** Listas, proyectos, recetas y eventos que este perfil no puede ver. */
async function hiddenIds(viewer: Viewer | null) {
  const rows = await Promise.all([
    db.shoppingLists.filter((row) => !canSee(viewer, row)).primaryKeys(),
    db.projects.filter((row) => !canSee(viewer, row)).primaryKeys(),
    db.recipes.filter((row) => !canSee(viewer, row)).primaryKeys(),
    db.events.filter((row) => !canSee(viewer, row)).primaryKeys(),
  ]);
  return new Set(rows.flat());
}
