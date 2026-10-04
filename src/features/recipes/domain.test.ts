import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { InventoryItem } from "@/features/inventory/domain";
import { parseNewComment } from "@/features/comments/domain";
import { fitWithin } from "@/features/media/domain";
import { ValidationError } from "@/lib/errors";
import { averageRating, checkAvailability, parseRecipe, scaleQuantity, type RecipeIngredient } from "./domain";

const item = (id: string, quantity: number): InventoryItem => ({ id, name: id, containerId: "c", quantity, minThreshold: 0, unit: "unidades", createdAt: 0, updatedAt: 0 });
const linked = (itemId: string, quantity: number): RecipeIngredient => ({ itemId, name: itemId, quantity, unit: "unidades" });

describe("porciones", () => {
  test("lo vinculado se redondea para arriba (no se cocina con medio huevo)", () => {
    assert.equal(scaleQuantity({ itemId: "huevos", quantity: 3 }, 4, 2), 2);
    assert.equal(scaleQuantity({ itemId: "huevos", quantity: 3 }, 4, 8), 6);
    assert.equal(scaleQuantity({ itemId: "huevos", quantity: 1 }, 4, 1), 1);
  });

  test("lo suelto se escala con decimales", () => {
    assert.equal(scaleQuantity({ quantity: 1.5 }, 4, 2), 0.75);
    assert.equal(scaleQuantity({ quantity: 1 }, 3, 1), 0.33);
  });
});

describe("disponibilidad", () => {
  const recipe = { servings: 4, ingredients: [linked("huevos", 3), linked("harina", 1), linked("leche", 1), linked("manteca", 1), { name: "sal", quantity: 1, unit: "pizca" }] };

  test("hay todo", () => {
    const items = new Map([["huevos", item("huevos", 6)], ["harina", item("harina", 1)], ["leche", item("leche", 2)], ["manteca", item("manteca", 1)]]);
    const report = checkAvailability(recipe, items);
    assert.equal(report.availability, "ready");
    assert.equal(report.checks.at(-1)!.state, "unlinked");
  });

  test("falta poco: uno solo", () => {
    const items = new Map([["huevos", item("huevos", 2)], ["harina", item("harina", 1)], ["leche", item("leche", 2)], ["manteca", item("manteca", 1)]]);
    const report = checkAvailability(recipe, items);
    assert.equal(report.availability, "almost");
    assert.deepEqual(report.lacking.map((check) => [check.ingredient.name, check.state]), [["huevos", "short"]]);
  });

  test("falta mucho; un producto borrado cuenta como no vinculado", () => {
    const items = new Map([["huevos", item("huevos", 0)], ["harina", item("harina", 0)]]);
    const report = checkAvailability(recipe, items);
    assert.equal(report.availability, "missing");
    assert.equal(report.checks.find((check) => check.ingredient.name === "leche")!.state, "unlinked");
  });

  test("con más porciones, lo que alcanzaba puede no alcanzar", () => {
    const items = new Map([["huevos", item("huevos", 3)], ["harina", item("harina", 1)], ["leche", item("leche", 1)], ["manteca", item("manteca", 1)]]);
    assert.equal(checkAvailability(recipe, items, 4).availability, "ready");
    assert.notEqual(checkAvailability(recipe, items, 8).availability, "ready");
  });

  test("sin nada vinculado no se sabe", () => {
    assert.equal(checkAvailability({ servings: 2, ingredients: [{ name: "sal", quantity: 1, unit: "pizca" }] }, new Map()).availability, "unknown");
  });
});

describe("validación de recetas", () => {
  const base = { name: "Tortilla", servings: 4, minutes: 30, ingredients: [], steps: [], tags: [] };

  test("limpia pasos vacíos, etiquetas desconocidas y repetidas", () => {
    const recipe = parseRecipe({ ...base, steps: [" Batir ", "", "  "], tags: ["quick", "quick", "inventada" as never] });
    assert.deepEqual(recipe.steps, ["Batir"]);
    assert.deepEqual(recipe.tags, ["quick"]);
  });

  test("lo vinculado va en enteros y con una unidad del inventario; lo suelto, libre", () => {
    assert.throws(() => parseRecipe({ ...base, ingredients: [{ itemId: "huevos", name: "Huevos", quantity: 1.5, unit: "unidades" }] }), ValidationError);
    assert.throws(() => parseRecipe({ ...base, ingredients: [{ itemId: "huevos", name: "Huevos", quantity: 1, unit: "puñado" }] }), ValidationError);
    assert.equal(parseRecipe({ ...base, ingredients: [{ name: "Azúcar", quantity: 0.5, unit: "taza" }] }).ingredients[0].quantity, 0.5);
  });

  test("rechaza nombre, porciones o tiempo inválidos", () => {
    assert.throws(() => parseRecipe({ ...base, name: " " }), ValidationError);
    assert.throws(() => parseRecipe({ ...base, servings: 0 }), ValidationError);
    assert.throws(() => parseRecipe({ ...base, minutes: -5 }), ValidationError);
  });
});

describe("puntajes y comentarios", () => {
  test("promedio ignorando los que no puntuaron", () => {
    assert.deepEqual(averageRating([5, undefined, 4]), { average: 4.5, count: 2 });
    assert.equal(averageRating([undefined]), null);
  });

  test("un comentario necesita texto o puntaje, y el puntaje va de 1 a 5", () => {
    assert.throws(() => parseNewComment({ ownerType: "recipe", ownerId: "r", text: "  " }), ValidationError);
    assert.throws(() => parseNewComment({ ownerType: "recipe", ownerId: "r", text: "", rating: 6 }), ValidationError);
    assert.equal(parseNewComment({ ownerType: "recipe", ownerId: "r", text: "", rating: 4 }).rating, 4);
  });
});

describe("fotos", () => {
  test("achica sin deformar y nunca agranda", () => {
    assert.deepEqual(fitWithin(4000, 3000, 1600), { width: 1600, height: 1200 });
    assert.deepEqual(fitWithin(800, 600, 1600), { width: 800, height: 600 });
  });
});
