/**
 * Cómo se juntan los cambios de varios dispositivos. Puro (sin base ni red): se prueba solo.
 *
 * Reglas:
 * - El orden lo da el servidor (`seq`), no el reloj de cada dispositivo: un celular con la hora
 *   mal no puede "ganar" siempre.
 * - Ediciones: gana la última, campo por campo. Si dos personas cambian campos distintos de la
 *   misma cosa, quedan los dos cambios.
 * - Lo que este dispositivo cambió y todavía no subió no se pisa: cuando suba, va a quedar después
 *   de todo lo que ya está en el servidor (su número va a ser mayor).
 * - Cantidades: diferencias que se suman ("usé uno" en dos celulares a la vez resta dos).
 * - Borrar gana sobre editar.
 */
import type { SyncScope } from "./protocol";
import { COUNTER_FIELDS, LOCAL_FIELDS, type SyncTable } from "./tables";

export type Row = Record<string, unknown> & { id: string };

/** Estado de sincronización de cada cosa de la casa (una fila de `syncRecords`). */
export interface SyncRecord {
  /** `tabla|id` */
  k: string;
  t: SyncTable;
  id: string;
  /** 1 si tiene algo para subir (número: IndexedDB no indexa booleanos). */
  pending: 0 | 1;
  /** Se creó acá y todavía no se subió entera. */
  full?: boolean;
  /** Se borró acá y falta avisar. */
  deleted?: boolean;
  /** Puede haber cambiado de nivel (cambió la privacidad de la lista donde está): revisarlo al subir. */
  rescope?: boolean;
  /** Campos cambiados sin subir → versión local de ese cambio. */
  dirty: Record<string, number>;
  /** Diferencias de cantidades sin subir. */
  deltas: Record<string, number>;
  /** Número de orden de la última escritura conocida de cada campo (si falta, `base`). */
  clocks: Record<string, number>;
  base: number;
  /** Nivel en el que se publicó por última vez (ahí se avisa si se borra o se mueve). */
  scope?: SyncScope;
  /** Borrada. `moved`: pasó a otro nivel; si vuelve entera desde ahí, revive. */
  gone?: { seq: number; moved?: boolean };
  /** Contador de cambios locales (versiona `dirty`). */
  ver: number;
}

/** Un cambio dentro de una operación. */
export interface Change {
  t: SyncTable;
  id: string;
  k: "put" | "del";
  /** La cosa entera (se crea donde no existe). */
  full?: true;
  /** Borrada de este nivel porque pasó a otro. */
  moved?: true;
  /** Campos con su valor nuevo. */
  f?: Record<string, unknown>;
  /** Campos que se quitaron. */
  u?: string[];
  /** Diferencias de cantidades. */
  d?: Record<string, number>;
}

/** Lo que se subió de un registro (para descontarlo cuando el servidor confirme). */
export interface Sent {
  deleted: boolean;
  full: boolean;
  rescope: boolean;
  fields: Record<string, number>;
  deltas: Record<string, number>;
  scope: SyncScope;
}

export const recordKey = (table: SyncTable, id: string) => `${table}|${id}`;

export function emptyRecord(table: SyncTable, id: string): SyncRecord {
  return { k: recordKey(table, id), t: table, id, pending: 0, dirty: {}, deltas: {}, clocks: {}, base: 0, ver: 0 };
}

function clone(record: SyncRecord): SyncRecord {
  return { ...record, dirty: { ...record.dirty }, deltas: { ...record.deltas }, clocks: { ...record.clocks }, gone: record.gone && { ...record.gone } };
}

function hasPending(record: SyncRecord) {
  return !!(record.full || record.deleted || record.rescope || Object.keys(record.dirty).length || Object.keys(record.deltas).length);
}

function settle(record: SyncRecord): SyncRecord {
  record.pending = hasPending(record) ? 1 : 0;
  return record;
}

/** Campos que viajan (sin el id ni lo que es solo de este dispositivo). */
export function syncedFields(table: SyncTable, row: Row): string[] {
  const local = LOCAL_FIELDS[table] ?? [];
  return Object.keys(row).filter((field) => field !== "id" && !local.includes(field) && row[field] !== undefined);
}

function same(a: unknown, b: unknown) {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

const isCounter = (table: SyncTable, field: string) => (COUNTER_FIELDS[table] ?? []).includes(field);
const isLocal = (table: SyncTable, field: string) => field === "id" || (LOCAL_FIELDS[table] ?? []).includes(field);
const clockOf = (record: SyncRecord, field: string) => record.clocks[field] ?? record.base;

/**
 * Un cambio hecho en este dispositivo. Devuelve el registro actualizado, `null` si hay que
 * olvidarlo (se creó y se borró sin llegar a subirse) o `undefined` si no cambió nada que viaje.
 */
export function trackLocal(meta: SyncRecord | undefined, table: SyncTable, id: string, before: Row | undefined, after: Row | undefined): SyncRecord | null | undefined {
  if (!before && !after) return undefined;
  const record = meta ? clone(meta) : emptyRecord(table, id);

  if (!after) {
    if (!record.scope) return null;
    Object.assign(record, { deleted: true, full: false, rescope: false, dirty: {}, deltas: {} });
    return settle(record);
  }
  if (!before) {
    record.full = true;
    record.deleted = false;
    delete record.gone;
    record.ver++;
    return settle(record);
  }

  let changed = false;
  for (const field of new Set([...syncedFields(table, before), ...syncedFields(table, after)])) {
    if (same(before[field], after[field])) continue;
    changed = true;
    const from = before[field];
    const to = after[field];
    if (isCounter(table, field) && typeof from === "number" && typeof to === "number") {
      const delta = (record.deltas[field] ?? 0) + (to - from);
      if (delta === 0) delete record.deltas[field];
      else record.deltas[field] = delta;
    } else {
      record.dirty[field] = ++record.ver;
    }
  }
  return changed ? settle(record) : undefined;
}

/** Marca que hay que revisar el nivel de una cosa (sin cambiar nada de ella). */
export function markRescope(meta: SyncRecord | undefined, table: SyncTable, id: string): SyncRecord | undefined {
  const record = meta ? clone(meta) : emptyRecord(table, id);
  if (!record.scope && !record.full) return undefined; // nunca se publicó: cuando se suba, ya sale con su nivel
  record.rescope = true;
  return settle(record);
}

/**
 * Qué subir de un registro con cambios. `scope` es su nivel actual. Si cambió de nivel, se borra
 * del anterior y se publica entera en el nuevo.
 */
export function outgoing(meta: SyncRecord, row: Row | undefined, scope: SyncScope): { changes: { scope: SyncScope; change: Change }[]; sent: Sent } | null {
  const sent: Sent = { deleted: false, full: false, rescope: !!meta.rescope, fields: { ...meta.dirty }, deltas: { ...meta.deltas }, scope };
  const { t, id } = meta;

  if (meta.deleted || !row) {
    if (!meta.scope) return null;
    return { changes: [{ scope: meta.scope, change: { t, id, k: "del" } }], sent: { ...sent, deleted: true, scope: meta.scope } };
  }

  const moving = !!meta.scope && meta.scope !== scope;
  if (meta.full || moving) {
    const f: Record<string, unknown> = {};
    for (const field of syncedFields(t, row)) f[field] = row[field];
    const changes: { scope: SyncScope; change: Change }[] = [];
    if (moving) changes.push({ scope: meta.scope!, change: { t, id, k: "del", moved: true } });
    changes.push({ scope, change: { t, id, k: "put", full: true, f } });
    return { changes, sent: { ...sent, full: true } };
  }

  const f: Record<string, unknown> = {};
  const u: string[] = [];
  for (const field of Object.keys(meta.dirty)) {
    if (row[field] === undefined) u.push(field);
    else f[field] = row[field];
  }
  const change: Change = { t, id, k: "put" };
  if (Object.keys(f).length) change.f = f;
  if (u.length) change.u = u;
  if (Object.keys(meta.deltas).length) change.d = { ...meta.deltas };
  const empty = !change.f && !change.u && !change.d;
  return { changes: empty ? [] : [{ scope, change }], sent };
}

/** El servidor confirmó lo subido con el número `seq` (sin número si no hubo nada que mandar). */
export function acknowledge(meta: SyncRecord, sent: Sent, seq?: number): SyncRecord {
  const record = clone(meta);
  // Se borró desde otro dispositivo mientras esto viajaba: el borrado manda, no hay nada que descontar.
  if (record.gone && !sent.deleted) return settle(record);
  if (sent.deleted) {
    Object.assign(record, { deleted: false, full: false, rescope: false, dirty: {}, deltas: {}, gone: { seq: seq ?? record.base } });
    return settle(record);
  }
  if (sent.full && seq !== undefined) {
    record.full = false;
    record.base = seq;
    record.clocks = {};
  }
  for (const [field, version] of Object.entries(sent.fields)) {
    if (record.dirty[field] === version) delete record.dirty[field];
    if (seq !== undefined) record.clocks[field] = seq;
  }
  for (const [field, delta] of Object.entries(sent.deltas)) {
    const rest = (record.deltas[field] ?? 0) - delta;
    if (rest === 0) delete record.deltas[field];
    else record.deltas[field] = rest;
  }
  if (sent.rescope) record.rescope = false;
  record.scope = sent.scope;
  return settle(record);
}

/**
 * Aplica un cambio que llegó de otro dispositivo, publicado en el nivel `scope` con el número
 * `seq`. `row`: `null` = borrarla, `undefined` = no tocarla, una fila = guardarla.
 */
export function applyRemote(meta: SyncRecord | undefined, local: Row | undefined, change: Change, seq: number, scope: SyncScope): { meta: SyncRecord; row: Row | null | undefined } {
  const record = meta ? clone(meta) : emptyRecord(change.t, change.id);
  const { t } = change;

  if (change.k === "del") {
    // Una baja definitiva le gana a una por mudanza; repetir una baja no cambia nada.
    if (record.gone && !(record.gone.moved && !change.moved)) return { meta: record, row: undefined };
    Object.assign(record, { full: false, deleted: false, rescope: false, dirty: {}, deltas: {}, gone: { seq, moved: change.moved } });
    return { meta: settle(record), row: local ? null : undefined };
  }

  if (record.gone) {
    if (!(record.gone.moved && change.full)) return { meta: record, row: undefined };
    delete record.gone;
  }
  // Si acá se borró y todavía no se avisó, el borrado gana.
  if (record.deleted) return { meta: record, row: undefined };

  const created = !local;
  // Un cambio parcial de algo que este dispositivo no tiene no alcanza para crearlo.
  if (created && !change.full) return { meta: record, row: undefined };
  const next: Row = created ? { id: change.id } : { ...local };

  const accepts = (field: string) => {
    if (isLocal(t, field)) return false;
    if (created) return true;
    if (isCounter(t, field)) return false; // las cantidades ya existentes cambian solo por diferencias
    return !(field in record.dirty) && clockOf(record, field) < seq;
  };
  for (const [field, value] of Object.entries(change.f ?? {})) {
    if (!accepts(field)) continue;
    next[field] = value;
    if (!created) record.clocks[field] = seq;
  }
  for (const field of change.u ?? []) {
    if (!accepts(field)) continue;
    delete next[field];
    if (!created) record.clocks[field] = seq;
  }
  if (!created) {
    for (const [field, delta] of Object.entries(change.d ?? {})) {
      if (isCounter(t, field) && Number.isFinite(delta)) next[field] = (typeof next[field] === "number" ? (next[field] as number) : 0) + delta;
    }
  } else {
    record.base = seq;
    record.clocks = {};
  }
  // Ahí vive ahora: si se borra o se mueve desde acá, se avisa en ese nivel. Una mudanza pendiente
  // de este dispositivo ya sabe a dónde va y no se toca.
  if (!record.rescope) record.scope = scope;
  return { meta: settle(record), row: next };
}
