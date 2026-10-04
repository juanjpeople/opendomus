"use client";

import { App } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import type { InventoryItem } from "@/features/inventory/domain";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { canSee } from "@/lib/sync/scope";
import { averageRating, checkAvailability, type AvailabilityReport, type Recipe, type RecipeInput } from "./domain";
import { addMissingToList, cookRecipe, createRecipe, deleteRecipe, setRecipeCover, updateRecipe, type Consumption } from "./service";

export interface RecipeSummary extends Recipe {
  report: AvailabilityReport;
  rating: { average: number; count: number } | null;
}

async function itemsById(recipes: Recipe[]) {
  const ids = [...new Set(recipes.flatMap((recipe) => recipe.ingredients.flatMap((ingredient) => (ingredient.itemId ? [ingredient.itemId] : []))))];
  return new Map((await db.inventory.bulkGet(ids)).flatMap((item): [string, InventoryItem][] => (item ? [[item.id, item]] : [])));
}

/** Todas las recetas con su disponibilidad y su puntaje. Reactivas al stock: si se acaba algo, cambia el estado. */
export function useRecipes(): RecipeSummary[] | undefined {
  const viewer = useCurrentUser();
  return useLiveQuery(async () => {
    const [all, comments] = await Promise.all([db.recipes.orderBy("name").toArray(), db.comments.where("[ownerType+ownerId]").between(["recipe", ""], ["recipe", "￿"]).toArray()]);
    const recipes = all.filter((recipe) => canSee(viewer, recipe));
    const items = await itemsById(recipes);
    return recipes.map((recipe) => ({
      ...recipe,
      report: checkAvailability(recipe, items),
      rating: averageRating(comments.filter((comment) => comment.ownerId === recipe.id).map((comment) => comment.rating)),
    }));
  }, [viewer?.id, viewer?.role]);
}

/** Nombres de las recetas para la búsqueda global (los ingredientes también encuentran: "zapallo"). */
export function useRecipeNames() {
  const viewer = useCurrentUser();
  return useLiveQuery(
    async () =>
      (await db.recipes.orderBy("name").toArray())
        .filter((recipe) => canSee(viewer, recipe))
        .map((recipe) => ({
          id: recipe.id,
          name: recipe.name,
          keywords: recipe.ingredients.map((ingredient) => ingredient.name).join(" "),
        })),
    [viewer?.id, viewer?.role],
  );
}

/** Una receta con los productos de sus ingredientes. `undefined` cargando, `null` si no existe. */
export function useRecipe(id: string | null) {
  const viewer = useCurrentUser();
  return useLiveQuery(async () => {
    if (!id) return null;
    const recipe = await db.recipes.get(id);
    if (!recipe || !canSee(viewer, recipe)) return null;
    return { recipe, items: await itemsById([recipe]) };
  }, [id, viewer?.id, viewer?.role]);
}

export function useRecipeActions() {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const t = useT();

  async function run<T>(action: () => Promise<T>, success?: string): Promise<T | null> {
    try {
      const result = await action();
      if (success) message.success(success);
      return result;
    } catch (error) {
      message.error(getErrorMessage(error, t));
      return null;
    }
  }

  return {
    create: (input: RecipeInput) => run(() => createRecipe(user, input), t("recipes.toast.created")),
    update: (id: string, input: RecipeInput) => run(() => updateRecipe(user, id, input), t("recipes.toast.saved")),
    remove: (id: string) => run(() => deleteRecipe(user, id), t("recipes.toast.deleted")),
    setCover: (id: string, photoId: string | undefined) => run(() => setRecipeCover(user, id, photoId)),
    cook: (id: string, servings: number, consumptions: Consumption[]) => run(() => cookRecipe(user, id, servings, consumptions)),
    addMissing: (id: string, servings: number) => run(() => addMissingToList(user, id, servings)),
  };
}
