/**
 * Recetas de la casa: ingredientes vinculados al inventario (o texto libre), pasos, etiquetas
 * y porciones. Sin React ni base de datos.
 */
import { INVENTORY_LIMITS, isUnit, type InventoryItem } from "@/features/inventory/domain";
import { ValidationError } from "@/lib/errors";

/** Etiquetas fijas (se traducen con `recipes.tags.<id>`): así se filtran igual en cualquier idioma. */
export const RECIPE_TAGS = ["quick", "vegetarian", "vegan", "kids", "healthy", "dessert", "budget", "batch", "party"] as const;
export type RecipeTag = (typeof RECIPE_TAGS)[number];

export interface RecipeIngredient {
  /** Producto del inventario: permite saber si hay y descontarlo al cocinar. */
  itemId?: string;
  /** Nombre visible. Si está vinculado, se guarda igual (por si el producto se borra). */
  name: string;
  /** Para la cantidad de porciones de la receta. Vinculado: entero, en la unidad del producto. */
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  servings: number;
  /** Tiempo total aproximado, en minutos. */
  minutes: number;
  /** Los ingredientes viven dentro de la receta: se guardan y se exportan juntos, siempre coherentes. */
  ingredients: RecipeIngredient[];
  steps: string[];
  tags: RecipeTag[];
  /** Foto principal (las demás son la galería, ver `features/media`). */
  coverPhotoId?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export type RecipeInput = Pick<Recipe, "name" | "servings" | "minutes" | "ingredients" | "steps" | "tags">;

export const RECIPE_LIMITS = {
  nameMaxLength: 80,
  maxServings: 50,
  maxMinutes: 24 * 60,
  maxIngredients: 40,
  maxSteps: 40,
  stepMaxLength: 1_000,
} as const;

function isTag(value: string): value is RecipeTag {
  return (RECIPE_TAGS as readonly string[]).includes(value);
}

function parseIngredient(input: RecipeIngredient): RecipeIngredient {
  const name = input.name?.trim() ?? "";
  if (!name) throw new ValidationError("errors.validation.ingredientName");
  if (name.length > INVENTORY_LIMITS.nameMaxLength) throw new ValidationError("errors.validation.nameTooLong", { max: INVENTORY_LIMITS.nameMaxLength });
  const linked = !!input.itemId;
  // Vinculado: entero (como el inventario). Suelto: se permite "0,5 taza".
  const validQuantity = typeof input.quantity === "number" && Number.isFinite(input.quantity) && input.quantity > 0 && input.quantity <= INVENTORY_LIMITS.maxQuantity;
  if (!validQuantity || (linked && !Number.isInteger(input.quantity))) throw new ValidationError("errors.validation.quantityInvalid");
  const unit = input.unit?.trim() ?? "";
  if (linked && !isUnit(unit)) throw new ValidationError("errors.validation.unitInvalid");
  return { itemId: input.itemId || undefined, name, quantity: input.quantity, unit: unit.slice(0, 20) };
}

/** Normaliza y valida. Los formularios validan para UX; esto es lo que vale. */
export function parseRecipe(input: RecipeInput): RecipeInput {
  const name = input.name?.trim() ?? "";
  if (!name) throw new ValidationError("errors.validation.nameRequired");
  if (name.length > RECIPE_LIMITS.nameMaxLength) throw new ValidationError("errors.validation.nameTooLong", { max: RECIPE_LIMITS.nameMaxLength });
  if (!Number.isInteger(input.servings) || input.servings < 1 || input.servings > RECIPE_LIMITS.maxServings) {
    throw new ValidationError("errors.validation.servingsInvalid");
  }
  if (!Number.isInteger(input.minutes) || input.minutes < 0 || input.minutes > RECIPE_LIMITS.maxMinutes) {
    throw new ValidationError("errors.validation.minutesInvalid");
  }
  const ingredients = (input.ingredients ?? []).map(parseIngredient);
  if (ingredients.length > RECIPE_LIMITS.maxIngredients) throw new ValidationError("errors.validation.tooMany", { max: RECIPE_LIMITS.maxIngredients });
  const steps = (input.steps ?? []).map((step) => step.trim()).filter(Boolean);
  if (steps.length > RECIPE_LIMITS.maxSteps) throw new ValidationError("errors.validation.tooMany", { max: RECIPE_LIMITS.maxSteps });
  if (steps.some((step) => step.length > RECIPE_LIMITS.stepMaxLength)) {
    throw new ValidationError("errors.validation.nameTooLong", { max: RECIPE_LIMITS.stepMaxLength });
  }
  const tags = [...new Set((input.tags ?? []).filter(isTag))];
  return { name, servings: input.servings, minutes: input.minutes, ingredients, steps, tags };
}

// --- Porciones y disponibilidad -------------------------------------------------

/** Cantidad de un ingrediente para otra cantidad de porciones. Lo vinculado se redondea para arriba (no se cocina con media lata). */
export function scaleQuantity(ingredient: Pick<RecipeIngredient, "quantity" | "itemId">, from: number, to: number): number {
  const scaled = (ingredient.quantity * to) / from;
  if (ingredient.itemId) return Math.max(1, Math.ceil(scaled - 1e-9));
  return Math.round(scaled * 100) / 100;
}

export type IngredientState = "ok" | "short" | "missing" | "unlinked";

export interface IngredientCheck {
  ingredient: RecipeIngredient;
  /** Cantidad necesaria para las porciones pedidas. */
  needed: number;
  /** Lo que hay en casa (solo vinculados que siguen existiendo). */
  have?: number;
  state: IngredientState;
  item?: InventoryItem;
}

/** "ready" = hay todo · "almost" = falta poco · "missing" = falta mucho · "unknown" = nada vinculado. */
export type Availability = "ready" | "almost" | "missing" | "unknown";

export interface AvailabilityReport {
  availability: Availability;
  checks: IngredientCheck[];
  /** Ingredientes vinculados que no alcanzan. */
  lacking: IngredientCheck[];
}

/**
 * ¿Se puede cocinar con lo que hay? Solo cuentan los ingredientes vinculados al inventario
 * (de los sueltos no se sabe). "Falta poco" = falta uno, o hasta un cuarto de lo vinculado.
 */
export function checkAvailability(recipe: Pick<Recipe, "ingredients" | "servings">, items: Map<string, InventoryItem>, servings = recipe.servings): AvailabilityReport {
  const checks = recipe.ingredients.map((ingredient): IngredientCheck => {
    const needed = scaleQuantity(ingredient, recipe.servings, servings);
    const item = ingredient.itemId ? items.get(ingredient.itemId) : undefined;
    if (!item) return { ingredient, needed, state: "unlinked" };
    const state: IngredientState = item.quantity >= needed ? "ok" : item.quantity > 0 ? "short" : "missing";
    return { ingredient, needed, have: item.quantity, state, item };
  });
  const linked = checks.filter((check) => check.state !== "unlinked");
  const lacking = linked.filter((check) => check.state !== "ok");
  const availability: Availability =
    linked.length === 0 ? "unknown" : lacking.length === 0 ? "ready" : lacking.length <= Math.max(1, Math.floor(linked.length / 4)) ? "almost" : "missing";
  return { availability, checks, lacking };
}

/** Puntaje promedio (1 a 5), o `null` si nadie puntuó. */
export function averageRating(ratings: (number | undefined)[]): { average: number; count: number } | null {
  const valid = ratings.filter((rating): rating is number => typeof rating === "number" && rating >= 1 && rating <= 5);
  if (valid.length === 0) return null;
  return { average: valid.reduce((sum, rating) => sum + rating, 0) / valid.length, count: valid.length };
}
