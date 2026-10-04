/**
 * Servicio de recetas: ÚNICO punto que las escribe. "Cociné esto" descuenta los ingredientes
 * con las reglas del inventario, y "Agregar lo que falta" anota con las de la lista de compras,
 * cada uno en una sola transacción (todo o nada).
 */
import { pruneActivity, recordActivity, setActivityPrivacy } from "@/features/activity/service";
import { deleteCommentsOfWithin } from "@/features/comments/service";
import { consumeWithin, QUANTITY_TABLES } from "@/features/inventory/service";
import { deletePhotosOfWithin } from "@/features/media/service";
import { addToListWithin, LIST_TABLES } from "@/features/shopping/service";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { createId } from "@/lib/id";
import { checkAvailability, parseRecipe, type RecipeInput } from "./domain";

async function getRecipe(id: string) {
  const recipe = await db.recipes.get(id);
  if (!recipe) throw new NotFoundError("errors.notFound.recipe");
  return recipe;
}

export async function createRecipe(actor: Actor | null, input: RecipeInput) {
  assertCan(actor, "recipes.manage");
  const data = parseRecipe(input);
  const id = createId();
  const now = Date.now();
  await db.transaction("rw", db.recipes, db.activity, async () => {
    await db.recipes.add({ ...data, id, createdBy: actor.id, createdAt: now, updatedAt: now });
    await recordActivity(actor, { module: "recipes", action: "create", entityId: id, entityName: data.name, privacy: data.privacy, createdBy: actor.id });
  });
  await pruneActivity();
  return id;
}

export async function updateRecipe(actor: Actor | null, id: string, input: RecipeInput) {
  assertCan(actor, "recipes.manage");
  const data = parseRecipe(input);
  await db.transaction("rw", db.recipes, db.activity, async () => {
    const recipe = await getRecipe(id);
    await setActivityPrivacy("recipes", id, data.privacy, recipe.createdBy);
    await db.recipes.update(id, { ...data, updatedAt: Date.now() });
    await recordActivity(actor, { module: "recipes", action: "update", entityId: id, entityName: data.name, privacy: data.privacy, createdBy: recipe.createdBy });
  });
}

/** Elige la portada entre las fotos de la receta. */
export async function setRecipeCover(actor: Actor | null, id: string, photoId: string | undefined) {
  assertCan(actor, "recipes.manage");
  await db.transaction("rw", db.recipes, db.photos, async () => {
    await getRecipe(id);
    if (photoId) {
      const photo = await db.photos.get(photoId);
      if (!photo || photo.ownerType !== "recipe" || photo.ownerId !== id) throw new NotFoundError("errors.notFound.photo");
    }
    await db.recipes.update(id, { coverPhotoId: photoId });
  });
}

/** Borra la receta con sus fotos y comentarios (no tienen sentido solos). */
export async function deleteRecipe(actor: Actor | null, id: string) {
  assertCan(actor, "recipes.manage");
  await db.transaction("rw", db.recipes, db.photos, db.comments, db.activity, db.photoDeletes, async () => {
    const recipe = await db.recipes.get(id);
    if (!recipe) return;
    await setActivityPrivacy("recipes", id, recipe.privacy ?? "family", recipe.createdBy);
    await db.recipes.delete(id);
    await deletePhotosOfWithin("recipe", id);
    await deleteCommentsOfWithin("recipe", id);
    await recordActivity(actor, { module: "recipes", action: "delete", entityId: id, entityName: recipe.name, privacy: recipe.privacy ?? "family", createdBy: recipe.createdBy });
  });
}

export interface Consumption {
  itemId: string;
  amount: number;
}

/**
 * "Cociné esto": descuenta lo que se usó (la persona lo revisa y ajusta antes). Cada descuento
 * queda como consumo del producto (se puede deshacer desde el historial) y la receta, como cocinada.
 * Devuelve qué productos no alcanzaron.
 */
export async function cookRecipe(actor: Actor | null, id: string, servings: number, consumptions: Consumption[]) {
  assertCan(actor, "inventory.consume");
  if (!Number.isInteger(servings) || servings < 1) throw new ValidationError("errors.validation.servingsInvalid");
  const short: { itemId: string; missing: number }[] = [];
  await db.transaction("rw", [db.recipes, ...QUANTITY_TABLES()], async () => {
    const recipe = await getRecipe(id);
    for (const { itemId, amount } of consumptions) {
      if (amount <= 0) continue;
      const plan = await consumeWithin(actor, itemId, amount);
      if (plan && plan.missing > 0) short.push({ itemId, missing: plan.missing });
    }
    await recordActivity(actor, { module: "recipes", action: "cooked", entityId: id, entityName: recipe.name, to: servings, privacy: recipe.privacy ?? "family", createdBy: recipe.createdBy });
  });
  await pruneActivity();
  return short;
}

/** Anota en la lista lo que falta para cocinarla (solo ingredientes vinculados al inventario). */
export async function addMissingToList(actor: Actor | null, id: string, servings: number) {
  assertCan(actor, "shopping.manage");
  let added = 0;
  await db.transaction("rw", [db.recipes, ...LIST_TABLES()], async () => {
    const recipe = await getRecipe(id);
    const itemIds = recipe.ingredients.flatMap((ingredient) => (ingredient.itemId ? [ingredient.itemId] : []));
    const items = new Map((await db.inventory.bulkGet(itemIds)).flatMap((item) => (item ? [[item.id, item] as const] : [])));
    for (const check of checkAvailability(recipe, items, servings).lacking) {
      const item = check.item!;
      await addToListWithin(actor, { name: item.name, quantity: check.needed - (check.have ?? 0), unit: item.unit, inventoryItemId: item.id });
      added++;
    }
  });
  await pruneActivity();
  return added;
}
