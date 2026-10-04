"use client";

import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { usePermission } from "@/lib/auth/hooks";
import { db } from "@/lib/db";
import type { ActivityEntry } from "./domain";

const EMPTY: ActivityEntry[] = [];

/**
 * Historial reactivo, de lo más nuevo a lo más viejo. Con `containerId`, solo lo de ese
 * contenedor; sin él, el de toda la casa. Sin permiso `activity.view` devuelve una lista vacía.
 */
export function useActivity({ containerId, limit = 50 }: { containerId?: string; limit?: number } = {}) {
  const allowed = usePermission("activity.view");

  return useLiveQuery(
    () => {
      if (!allowed) return EMPTY;
      const query = containerId
        ? db.activity.where("[containerId+at]").between([containerId, Dexie.minKey], [containerId, Dexie.maxKey]).reverse()
        : db.activity.orderBy("at").reverse();
      return query.limit(limit).toArray();
    },
    [allowed, containerId, limit],
  );
}
