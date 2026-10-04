/**
 * Protocolo de sincronización entre la app y el servidor. Lo importan los dos (sin dependencias:
 * el servidor no tiene el alias `@/`).
 *
 * Cada operación viaja cifrada con la clave de su nivel y firmada por su autor (Ed25519). El
 * servidor ve solo lo mínimo para autorizar y ordenar: id, nivel, versión de la clave y autor.
 * El contenido (qué cambió) está adentro de `body` y solo lo abren los dispositivos de la casa.
 */

export type SyncScope = "family" | "adults" | "private";

/** Lo que el dispositivo sube. */
export interface WireOp {
  id: string;
  scope: SyncScope;
  keyVersion: number;
  /** Caja cifrada (`iv.ciphertext`) con los cambios. */
  body: string;
  /** Firma Ed25519 del autor sobre `opSigningData`. */
  sig: string;
}

/** Lo que el servidor devuelve: la operación con su número de orden y su autor. */
export interface StoredOp extends WireOp {
  seq: number;
  author: string;
}

export interface PushResponse {
  acks: { id: string; seq: number }[];
}

export interface PullResponse {
  ops: StoredOp[];
  /** Desde dónde seguir pidiendo. Igual a `head` cuando no queda nada. */
  next: number;
  /** Última operación de la casa (aunque no sea visible para quien pide). */
  head: number;
}

export const SYNC_LIMITS = {
  opsPerPush: 100,
  /** Caracteres de `body` por operación (~140 KB de datos). */
  opBodyChars: 192_000,
  pushBytes: 2_000_000,
  pullBytes: 2_000_000,
  pullOps: 500,
} as const;

/**
 * Contexto de cifrado de una operación (va como datos adicionales de AES-GCM): el servidor no
 * puede mover una operación a otra casa, otro nivel u otro autor sin que deje de abrir.
 */
export function opContext(householdId: string, op: Pick<WireOp, "id" | "scope" | "keyVersion">, author: string) {
  return `op/v1|${householdId}|${op.id}|${op.scope}|${op.keyVersion}|${author}`;
}

/** Lo que firma el autor (y verifican el servidor y cada dispositivo). */
export function opSigningData(householdId: string, op: WireOp, author: string) {
  return `${opContext(householdId, op, author)}|${op.body}`;
}
