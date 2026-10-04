/**
 * Historial de acciones: quién hizo qué, cuándo y sobre qué. Lo escriben los servicios
 * (nunca la UI), dentro de la misma transacción que el cambio, así no hay cambios sin registro.
 */

/** Qué tipo de cosa cambió. Cada módulo nuevo suma su valor acá. */
export type ActivityModule = "inventory" | "storage" | "prices" | "members" | "calendar" | "shopping" | "recipes" | "lists" | "projects";

export type ActivityAction =
  | "create"
  | "adjust"
  | "update"
  | "move"
  | "delete"
  | "price"
  /** Inventario: se usó o consumió (distinto de corregir la cantidad). */
  | "consume"
  /** Inventario: entró por una compra de la lista. */
  | "restock"
  /** Inventario: se deshizo un cambio de cantidad anterior. */
  | "undo"
  /** Compras: se marcó como comprado. */
  | "bought"
  /** Compras: se descartó una sugerencia. */
  | "dismiss"
  /** Recetas: alguien la cocinó (los ingredientes descontados quedan como consumos). */
  | "cooked";

export interface ActivityEntry {
  id: string;
  at: number;
  module: ActivityModule;
  action: ActivityAction;
  /** Se guarda el nombre además del id: el historial tiene que leerse aunque el perfil cambie. */
  actorId: string;
  actorName: string;
  entityId: string;
  /** Nombre al momento de la acción (lo afectado puede haberse renombrado o borrado después). */
  entityName: string;
  /** Contenedor donde ocurrió (para el historial de cada contenedor). */
  containerId?: string;
  /** Nombre del lugar al momento de la acción ("Heladera", "Taller"…). */
  place?: string;
  /** Lista de compras donde ocurrió: la entrada hereda su privacidad (lo de "Adultos" no lo ven los chicos). */
  listId?: string;
  /** Ajustes de cantidad. */
  from?: number;
  to?: number;
  unit?: string;
  /** Precios. */
  amountCents?: number;
  currency?: string;
  store?: string;
  /** Si se deshizo: cuándo y quién (la entrada queda, tachada, para que el historial no mienta). */
  undoneAt?: number;
  undoneBy?: string;
}

export const ACTIVITY_LIMITS = {
  /** Ajustes seguidos del mismo ítem por la misma persona se agrupan en una sola entrada. */
  coalesceMs: 60_000,
  /** Tope de entradas guardadas: al superarlo se borran las más viejas. */
  maxEntries: 5_000,
  /** Hasta cuándo se puede deshacer un cambio de cantidad. */
  undoWindowMs: 24 * 60 * 60_000,
} as const;

/** Cambios de cantidad que se pueden deshacer desde el historial. */
const UNDOABLE: ReadonlySet<ActivityAction> = new Set(["consume", "adjust", "restock"]);

/** ¿Se puede deshacer? Solo cambios de cantidad recientes y que no se hayan deshecho ya. */
export function isUndoable(entry: ActivityEntry, now: number): boolean {
  return (
    entry.module === "inventory" &&
    UNDOABLE.has(entry.action) &&
    entry.undoneAt === undefined &&
    entry.from !== undefined &&
    entry.to !== undefined &&
    entry.from !== entry.to &&
    now - entry.at < ACTIVITY_LIMITS.undoWindowMs
  );
}
