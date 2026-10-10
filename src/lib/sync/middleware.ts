import { DEMO_ENABLED, houseStorageKey } from "@/lib/demo";
/**
 * Registro de cambios locales, sin tocar los servicios: un middleware de Dexie ve cada escritura
 * (agregar, editar, borrar) de las tablas que se sincronizan y, en la MISMA transacción, anota
 * qué cambió en `syncRecords`. Si la transacción falla, no queda nada anotado; si se confirma,
 * el motor de sincronización lo sube.
 *
 * En una casa solo local (sin `SyncLink`) no hace nada.
 */
import type { DBCore, DBCoreMutateRequest, DBCoreMutateResponse, DBCoreTable, Middleware, Transaction } from "dexie";
import { recordKey, trackLocal, type Row, type SyncRecord } from "./merge";
import { isSyncTable, SYNC_META_TABLES, type SyncTable } from "./tables";

/** A qué casa de la nube está atada la base de este dispositivo. */
export interface SyncLink {
  householdId: string;
  userId: string;
  /** Identifica este dispositivo (para no volver a aplicar lo que él mismo subió). */
  deviceId: string;
}

const LINK_KEY = houseStorageKey("refugiar-sync-link");

function readLink(): SyncLink | null {
  if (DEMO_ENABLED) return null;
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(LINK_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<SyncLink>) : null;
    return parsed?.householdId && parsed.userId && parsed.deviceId ? (parsed as SyncLink) : null;
  } catch {
    return null;
  }
}

let link: SyncLink | null = readLink();

if (typeof window !== "undefined") {
  // Otra pestaña ató o desató la casa.
  window.addEventListener("storage", (event) => {
    if (event.key === LINK_KEY) link = readLink();
  });
}

export function getSyncLink(): SyncLink | null {
  return link;
}

export function setSyncLink(next: SyncLink | null) {
  if (DEMO_ENABLED) return;
  link = next;
  try {
    if (next) localStorage.setItem(LINK_KEY, JSON.stringify(next));
    else localStorage.removeItem(LINK_KEY);
  } catch {
    // Sin localStorage (modo privado estricto): la casa queda atada mientras dure la pestaña.
  }
}

const UNTRACKED = "__refugiarUntracked";
const NOTIFY = "__refugiarNotify";

/**
 * Escrituras que no se suben: lo que llega de otros dispositivos y la limpieza propia de este
 * dispositivo (por ejemplo, recortar el historial viejo).
 */
export function untracked(tx: Transaction) {
  (tx.idbtrans as unknown as Record<string, unknown>)[UNTRACKED] = true;
}

const listeners = new Set<() => void>();

/** Avisa (después de confirmarse la transacción) que hay cambios locales para subir. */
export function onLocalChange(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

type TrackedTransaction = IDBTransaction & Record<string, unknown>;

async function affectedKeys(table: DBCoreTable, req: DBCoreMutateRequest): Promise<string[]> {
  switch (req.type) {
    case "add":
    case "put":
      return req.keys ?? req.values.map((value: Row) => value.id);
    case "delete":
      return req.keys;
    case "deleteRange": {
      const { result } = await table.query({ trans: req.trans, values: false, query: { index: table.schema.primaryKey, range: req.range } });
      return result;
    }
  }
}

async function trackedMutate(down: DBCore, table: DBCoreTable, name: SyncTable, req: DBCoreMutateRequest): Promise<DBCoreMutateResponse> {
  const trans = req.trans as unknown as TrackedTransaction;
  // Las migraciones del esquema corren igual en cada dispositivo: no se suben.
  if (!link || trans[UNTRACKED] || trans.mode === "versionchange") return table.mutate(req);

  const keys = await affectedKeys(table, req);
  if (keys.length === 0) return table.mutate(req);
  const before: (Row | undefined)[] = await table.getMany({ trans: req.trans, keys });
  const response = await table.mutate(req);
  const after: (Row | undefined)[] = req.type === "add" || req.type === "put" ? [...req.values] : keys.map(() => undefined);

  const meta = down.table("syncRecords");
  const metaKeys = keys.map((id) => recordKey(name, id));
  const current: (SyncRecord | undefined)[] = await meta.getMany({ trans: req.trans, keys: metaKeys });
  const puts: SyncRecord[] = [];
  const forget: string[] = [];
  keys.forEach((id, index) => {
    if (response.failures[index]) return;
    const next = trackLocal(current[index], name, id, before[index], after[index]);
    if (next === null) forget.push(metaKeys[index]);
    else if (next) puts.push(next);
  });
  if (puts.length) await meta.mutate({ type: "put", trans: req.trans, values: puts });
  if (forget.length) await meta.mutate({ type: "delete", trans: req.trans, keys: forget });

  if (puts.some((record) => record.pending) && !trans[NOTIFY]) {
    trans[NOTIFY] = true;
    trans.addEventListener("complete", () => listeners.forEach((listener) => listener()));
  }
  return response;
}

export const syncMiddleware: Middleware<DBCore> = {
  stack: "dbcore",
  name: "RefugiarSync",
  // Debajo de las capas de Dexie (caché, observabilidad, hooks: niveles -1 a 2), pegada a
  // IndexedDB: esas capas leen el contexto de la transacción de Dexie, que no sobrevive a los
  // `await` de acá. Ellas siguen viendo cada escritura de la app, porque pasa por arriba.
  level: -2,
  create(down) {
    return {
      ...down,
      // Toda transacción que escribe algo sincronizable incluye también las tablas de la
      // sincronización: así el registro del cambio entra en la misma transacción que el cambio.
      transaction(stores, mode, options) {
        const tracked = mode === "readwrite" && stores.some(isSyncTable);
        return down.transaction(tracked ? [...new Set([...stores, ...SYNC_META_TABLES])] : stores, mode, options);
      },
      table(name) {
        const table = down.table(name);
        if (!isSyncTable(name)) return table;
        return { ...table, mutate: (req) => trackedMutate(down, table, name, req) };
      },
    };
  },
};
