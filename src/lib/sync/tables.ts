/**
 * Qué se sincroniza. Todo lo de la casa, salvo:
 * - los bytes de las fotos (pesan: van aparte, cifrados; acá viaja solo su ficha y su clave);
 * - el PIN y las huellas de cada perfil, que protegen el perfil EN ese dispositivo (un PIN de
 *   4 dígitos sincronizado se podría adivinar desde otro dispositivo de la casa).
 *
 * El orden importa al subir una casa entera: primero lo que otras cosas referencian.
 */
export const SYNC_TABLES = [
  "members",
  "houseSettings",
  "spaces",
  "containers",
  "containerContents",
  "inventory",
  "prices",
  "projects",
  "shoppingLists",
  "shoppingList",
  "shoppingCandidates",
  "events",
  "recipes",
  "photos",
  "comments",
  "activity",
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

const SYNCED = new Set<string>(SYNC_TABLES);

export function isSyncTable(name: string): name is SyncTable {
  return SYNCED.has(name);
}

/** Campos que no salen del dispositivo. */
export const LOCAL_FIELDS: Partial<Record<SyncTable, readonly string[]>> = {
  members: ["pin", "credentials"],
  // Los bytes de las fotos viajan aparte, cifrados (ver `src/lib/sync/photos.ts`).
  photos: ["blob", "thumb"],
};

/** Cantidades: viajan como diferencias, así dos consumos simultáneos se suman en vez de pisarse. */
export const COUNTER_FIELDS: Partial<Record<SyncTable, readonly string[]>> = {
  inventory: ["quantity"],
};

/** Tablas propias de la sincronización (no se sincronizan ellas mismas). */
export const SYNC_META_TABLES = ["syncRecords", "syncState"] as const;
