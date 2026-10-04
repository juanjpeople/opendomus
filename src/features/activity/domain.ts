/**
 * Historial de acciones: quién hizo qué, cuándo y sobre qué. Lo escriben los servicios
 * (nunca la UI), dentro de la misma transacción que el cambio, así no hay cambios sin registro.
 */

/** Qué tipo de cosa cambió. Cada módulo nuevo suma su valor acá. */
export type ActivityModule = "inventory" | "storage" | "prices" | "members" | "calendar";

export type ActivityAction = "create" | "adjust" | "update" | "move" | "delete" | "price";

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
  /** Ajustes de cantidad. */
  from?: number;
  to?: number;
  unit?: string;
  /** Precios. */
  amountCents?: number;
  currency?: string;
  store?: string;
}

export const ACTIVITY_LIMITS = {
  /** Ajustes seguidos del mismo ítem por la misma persona se agrupan en una sola entrada. */
  coalesceMs: 60_000,
  /** Tope de entradas guardadas: al superarlo se borran las más viejas. */
  maxEntries: 5_000,
} as const;
