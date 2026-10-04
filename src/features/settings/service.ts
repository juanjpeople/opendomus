/**
 * Operaciones sobre los datos del dispositivo. Las que tocan los datos de la casa
 * (exportar, borrar) exigen `settings.data`; la caché no contiene datos de nadie.
 */
import Dexie from "dexie";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { db, declareSchema } from "@/lib/db";
import { AppError, ValidationError } from "@/lib/errors";

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

/** Resumen de un archivo exportado, para confirmar antes de importarlo. */
export interface ImportPreview {
  data: DataExport;
  exportedAt: number;
  records: number;
}

/** Valida un export (lo que sea que haya elegido el usuario) sin tocar nada. */
export function parseExport(raw: unknown): ImportPreview {
  const data = raw as Partial<DataExport> | null;
  if (!data || typeof data !== "object" || data.app !== "OpenDomus" || typeof data.tables !== "object" || data.tables === null) {
    throw new ValidationError("errors.import.invalid");
  }
  if (!Number.isInteger(data.schemaVersion) || (data.schemaVersion ?? 0) < 1) throw new ValidationError("errors.import.invalid");
  if (data.schemaVersion! > db.verno) throw new ValidationError("errors.import.newer");
  const tables = Object.values(data.tables);
  if (!tables.every(Array.isArray)) throw new ValidationError("errors.import.invalid");
  const exportedAt = Date.parse(data.exportedAt ?? "");
  return { data: data as DataExport, exportedAt: Number.isNaN(exportedAt) ? 0 : exportedAt, records: tables.reduce((sum, rows) => sum + rows.length, 0) };
}

const IMPORT_DB = "OpenDomusImport";

/**
 * Reemplaza TODOS los datos del dispositivo por los de un export. Si el archivo es de una
 * versión vieja, se carga en una base temporal con ese esquema y se abre con el actual:
 * corren las mismas migraciones que en cualquier casa, y recién ahí se copia a la base real.
 * Si algo falla en el camino, los datos actuales quedan como estaban. Después hay que recargar.
 */
export async function importAllData(actor: Actor | null, preview: ImportPreview) {
  assertCan(actor, "settings.data");
  const { data } = preview;
  try {
    await Dexie.delete(IMPORT_DB);
    const staging = new Dexie(IMPORT_DB);
    declareSchema(staging, data.schemaVersion);
    await staging.open();
    await staging.transaction("rw", staging.tables, async () => {
      for (const table of staging.tables) {
        const rows = data.tables[table.name];
        if (rows?.length) await table.bulkPut(rows as never[]);
      }
    });
    staging.close();

    const upgraded = new Dexie(IMPORT_DB);
    declareSchema(upgraded);
    await upgraded.open();
    const tables: Record<string, unknown[]> = {};
    for (const table of upgraded.tables) tables[table.name] = await table.toArray();
    upgraded.close();

    await db.transaction("rw", db.tables, async () => {
      for (const table of db.tables) {
        await table.clear();
        if (tables[table.name]?.length) await table.bulkAdd(tables[table.name] as never[]);
      }
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new ValidationError("errors.import.invalid");
  } finally {
    await Dexie.delete(IMPORT_DB).catch(() => {});
  }
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
