import type { Change } from "./merge";

export const CONTAINER_BACKFILL = "containerContentsBackfillUntil";
export const SETTINGS_BACKFILL = "houseSettingsBackfillUntil";

/** No mezclar una tabla nueva con inventario: v11 rechazaría también los cambios que sí conoce. */
export function storageCompatibleGroups<T extends { change: Change }>(entries: T[]): T[][] {
  return [entries.filter(({ change }) => change.t !== "containerContents" && change.t !== "houseSettings"), entries.filter(({ change }) => change.t === "containerContents"), entries.filter(({ change }) => change.t === "houseSettings")].filter((group) => group.length > 0);
}

/** v11 rechazaba una operación ENTERA si incluía una tabla desconocida. Solo esas se recuperan. */
export function shouldApplyAfterStorageUpgrade(seq: number, previousCursor: number | undefined, changes: Change[], settingsCursor?: number): boolean {
  const through = Math.max(previousCursor ?? 0, settingsCursor ?? 0);
  return seq > through || changes.some((change) =>
    (previousCursor !== undefined && change.t === "containerContents") ||
    (settingsCursor !== undefined && change.t === "houseSettings"));
}
