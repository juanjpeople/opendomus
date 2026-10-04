/**
 * Fotos con la casa en la nube. La ficha de cada foto (de quién es, medidas, su clave) se
 * sincroniza como cualquier cosa; los bytes van aparte:
 * - quien tiene los bytes los cifra con la clave propia de la foto y los sube (miniatura y
 *   completa), y recién entonces la marca `uploaded` (así los demás saben que pueden bajarla);
 * - los demás la bajan cuando la ven (`ensurePhotoBytes`), la descifran y la guardan acá.
 *
 * La clave viaja dentro del registro de la casa, cifrada con el nivel de su receta: el servidor y
 * R2 solo ven bytes que no pueden abrir. Rotar las claves de la casa no obliga a re-cifrar fotos.
 */
import type { Photo } from "@/features/media/domain";
import { api, apiBytes } from "@/lib/cloud/api";
import { fromB64u, importScopeKey, newScopeKey, openBinary, sealBinary, toB64u } from "@/lib/crypto";
import { db } from "@/lib/db";
import { getSyncLink, untracked } from "./middleware";

type Field = "blob" | "thumb";
export interface PhotoDelete {
  k: string;
  householdId: string;
  photoId: string;
  requestedAt: number;
}

const VARIANT: Record<Field, "full" | "thumb"> = { blob: "full", thumb: "thumb" };

const photoContext = (photoId: string, field: Field) => `photo/v1|${photoId}|${VARIANT[field]}`;
const photoPath = (householdId: string, photoId: string) => `/households/${householdId}/photos/${photoId}`;

/** Clave nueva para una foto (AES-256, base64url). */
export function newPhotoKey() {
  return toB64u(newScopeKey());
}

/**
 * Sube las fotos que este dispositivo tiene y todavía no están en la nube. Corre después de cada
 * vuelta de la sincronización. Una que falla queda para la próxima.
 */
export async function uploadPendingPhotos(householdId: string) {
  const pending = await db.photos.filter((photo) => !photo.uploaded && !!photo.blob && !!photo.thumb).toArray();
  for (const photo of pending) {
    let key = photo.key;
    if (!key) {
      // Fotos de antes de pasar a la nube: la clave se crea ahora (y viaja con la ficha).
      key = newPhotoKey();
      await db.photos.update(photo.id, { key, mime: photo.blob!.type || undefined });
    }
    const cryptoKey = await importScopeKey(fromB64u(key));
    for (const field of ["thumb", "blob"] as const) {
      const bytes = new Uint8Array(await photo[field]!.arrayBuffer());
      await apiBytes("PUT", `${photoPath(householdId, photo.id)}/${VARIANT[field]}`, await sealBinary(cryptoKey, bytes, photoContext(photo.id, field)));
    }
    await db.photos.update(photo.id, { uploaded: true });
  }
}

const inflight = new Map<string, Promise<void>>();

/**
 * Si a esta foto le faltan los bytes (vino de otro dispositivo) y ya están en la nube, los baja,
 * los descifra y los guarda acá. Una sola vez por foto y variante, aunque la pidan varias pantallas.
 */
export function ensurePhotoBytes(photo: Pick<Photo, "id" | "key" | "uploaded" | "mime" | Field>, field: Field) {
  const link = getSyncLink();
  if (photo[field] || !photo.uploaded || !photo.key || !link) return;
  const id = `${photo.id}:${field}`;
  if (inflight.has(id)) return;
  const key = photo.key;
  const task = (async () => {
    const sealed = await apiBytes("GET", `${photoPath(link.householdId, photo.id)}/${VARIANT[field]}`);
    const bytes = await openBinary(await importScopeKey(fromB64u(key)), sealed, photoContext(photo.id, field));
    const blob = new Blob([new Uint8Array(bytes)], { type: photo.mime || "image/webp" });
    // Los bytes son de este dispositivo (no viajan): guardarlos no es un cambio para subir.
    await db.transaction("rw", db.photos, async (tx) => {
      untracked(tx);
      if (await db.photos.get(photo.id)) await db.photos.update(photo.id, { [field]: blob });
    });
  })()
    .catch((error: unknown) => console.warn("[fotos] no se pudo bajar", photo.id, error))
    .finally(() => setTimeout(() => inflight.delete(id), 30_000)); // si falló, se reintenta en un rato
  inflight.set(id, task);
}

/** Conserva el trabajo hasta que R2 confirme el borrado; debe llamarse dentro de la transacción local. */
export async function queuePhotoDeletes(photoIds: string[]) {
  const link = getSyncLink();
  if (!link || photoIds.length === 0) return;
  const requestedAt = Date.now();
  await db.photoDeletes.bulkPut(
    photoIds.map((photoId) => ({
      k: `${link.householdId}|${photoId}`,
      householdId: link.householdId,
      photoId,
      requestedAt,
    })),
  );
}

/** Reintenta los borrados pendientes y solo olvida cada tarea cuando el servidor confirma. */
export async function flushPendingPhotoDeletes(householdId: string) {
  const pending = await db.photoDeletes.where("householdId").equals(householdId).sortBy("requestedAt");
  for (const entry of pending) {
    await api("DELETE", photoPath(householdId, entry.photoId));
    await db.photoDeletes.delete(entry.k);
  }
}
