/**
 * Servicio de fotos: ÚNICO punto que las escribe. El permiso depende de a quién pertenecen
 * (las fotos de una receta las maneja quien puede editar recetas).
 */
import { assertCan, type Actor, type Permission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { createId } from "@/lib/id";
import { compressImage } from "@/lib/images";
import { PHOTO_LIMITS, type PhotoOwner } from "./domain";

const MANAGE: Record<PhotoOwner, Permission> = { recipe: "recipes.manage" };

/** Comprime y guarda fotos. Devuelve los ids, en el mismo orden. */
export async function addPhotos(actor: Actor | null, ownerType: PhotoOwner, ownerId: string, files: File[]) {
  assertCan(actor, MANAGE[ownerType]);
  const existing = await db.photos.where("[ownerType+ownerId]").equals([ownerType, ownerId]).count();
  if (existing + files.length > PHOTO_LIMITS.maxPerOwner) throw new ValidationError("errors.validation.tooManyPhotos", { max: PHOTO_LIMITS.maxPerOwner });

  // Comprimir es lo lento: se hace antes de abrir la transacción (IndexedDB no espera promesas ajenas).
  const prepared = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) throw new ValidationError("errors.validation.notAnImage");
    if (file.size > PHOTO_LIMITS.maxInputBytes) throw new ValidationError("errors.validation.imageTooLarge");
    try {
      prepared.push(await compressImage(file, PHOTO_LIMITS));
    } catch {
      throw new ValidationError("errors.validation.notAnImage");
    }
  }

  const now = Date.now();
  const photos = prepared.map((image, index) => ({ ...image, id: createId(), ownerType, ownerId, createdBy: actor.id, createdAt: now + index }));
  await db.photos.bulkAdd(photos);
  return photos.map((photo) => photo.id);
}

export async function deletePhoto(actor: Actor | null, id: string) {
  const photo = await db.photos.get(id);
  if (!photo) return;
  assertCan(actor, MANAGE[photo.ownerType]);
  await db.transaction("rw", db.photos, db.recipes, async () => {
    await db.photos.delete(id);
    // Si era la portada, la receta se queda sin portada (o toma la siguiente foto).
    if (photo.ownerType === "recipe") {
      const recipe = await db.recipes.get(photo.ownerId);
      if (recipe?.coverPhotoId === id) {
        const next = await db.photos.where("[ownerType+ownerId]").equals(["recipe", photo.ownerId]).first();
        await db.recipes.update(recipe.id, { coverPhotoId: next?.id });
      }
    }
  });
}

/** Borra todas las fotos de algo (al borrarlo). Para otros servicios, dentro de su transacción. */
export async function deletePhotosOfWithin(ownerType: PhotoOwner, ownerId: string) {
  await db.photos.where("[ownerType+ownerId]").equals([ownerType, ownerId]).delete();
}
