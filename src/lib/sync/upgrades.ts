import type { Change } from "./merge";

export const CONTAINER_BACKFILL = "containerContentsBackfillUntil";

/** No mezclar una tabla nueva con inventario: v11 rechazaría también los cambios que sí conoce. */
export function storageCompatibleGroups<T extends { change: Change }>(entries: T[]): T[][] {
  return [entries.filter(({ change }) => change.t !== "containerContents"), entries.filter(({ change }) => change.t === "containerContents")].filter((group) => group.length > 0);
}

/** v11 rechazaba una operación ENTERA si incluía una tabla desconocida. Solo esas se recuperan. */
export function shouldApplyAfterStorageUpgrade(seq: number, previousCursor: number | undefined, changes: Change[]): boolean {
  return previousCursor === undefined || seq > previousCursor || changes.some((change) => change.t === "containerContents");
}
