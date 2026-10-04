/**
 * Operaciones sobre los datos del dispositivo. Las que tocan los datos de la casa
 * (exportar, borrar) exigen `settings.data`; la caché no contiene datos de nadie.
 */
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/** Prefijo de todo lo que la app guarda en localStorage (preferencias, sesión, navegación). */
const STORAGE_PREFIX = "opendomus-";

export interface DataExport {
  app: "OpenDomus";
  version: string;
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

/** Todo lo que hay en la base, en un formato abierto y autodescriptivo. */
export async function exportAllData(actor: Actor | null): Promise<DataExport> {
  assertCan(actor, "settings.data");
  const tables: Record<string, unknown[]> = {};
  await db.transaction("r", db.tables, async () => {
    for (const table of db.tables) tables[table.name] = await table.toArray();
  });
  return { app: "OpenDomus", version: APP_VERSION, schemaVersion: db.verno, exportedAt: new Date().toISOString(), tables };
}

/** Borra la base y todo lo guardado en localStorage. Después hay que recargar la app. */
export async function deleteAllData(actor: Actor | null) {
  assertCan(actor, "settings.data");
  await db.delete();
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
  }
  sessionStorage.clear();
}

/** Caché del navegador (Cache Storage y service workers). No toca datos ni preferencias. */
export async function clearCache() {
  if ("caches" in window) {
    for (const key of await caches.keys()) await caches.delete(key);
  }
  if ("serviceWorker" in navigator) {
    for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister();
  }
  sessionStorage.clear();
}

/** Espacio usado y disponible, si el navegador lo informa. */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
