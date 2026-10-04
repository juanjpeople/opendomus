import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { PriceRecord, PriceSummary } from "@/features/prices/domain";
import { ValidationError } from "@/lib/errors";
import { decideSuggestion, estimateList, parseNewShoppingItem, suggestedQuantity } from "./domain";

const item = (quantity: number, minThreshold = 2, autoSuggest?: boolean) => ({ quantity, minThreshold, autoSuggest });

describe("sugerencias automáticas", () => {
  test("entra en 'Para revisar' al cruzar el mínimo", () => {
    assert.deepEqual(decideSuggestion({ previous: "ok", item: item(1), pendingReason: null, onList: false }), { type: "create", reason: "low" });
    assert.deepEqual(decideSuggestion({ previous: "ok", item: item(0), pendingReason: null, onList: false }), { type: "create", reason: "empty" });
  });

  test("un producto nuevo que ya arranca bajo también se sugiere", () => {
    assert.deepEqual(decideSuggestion({ previous: null, item: item(0), pendingReason: null, onList: false }), { type: "create", reason: "empty" });
  });

  test("sin cruzar el mínimo no vuelve a sugerir (descartar no se deshace con el próximo clic)", () => {
    assert.deepEqual(decideSuggestion({ previous: "low", item: item(1), pendingReason: null, onList: false }), { type: "none" });
    assert.deepEqual(decideSuggestion({ previous: "low", item: item(0), pendingReason: null, onList: false }), { type: "none" });
  });

  test("no sugiere si ya está en la lista o si se pidió no sugerirlo", () => {
    assert.deepEqual(decideSuggestion({ previous: "ok", item: item(1), pendingReason: null, onList: true }), { type: "none" });
    assert.deepEqual(decideSuggestion({ previous: "ok", item: item(1, 2, false), pendingReason: null, onList: false }), { type: "none" });
  });

  test("si se agota, la sugerencia pendiente se vuelve más urgente", () => {
    assert.deepEqual(decideSuggestion({ previous: "low", item: item(0), pendingReason: "low", onList: false }), { type: "update", reason: "empty" });
    assert.deepEqual(decideSuggestion({ previous: "low", item: item(1), pendingReason: "low", onList: false }), { type: "none" });
  });

  test("si vuelve el stock antes de revisarla, se retira sola", () => {
    assert.deepEqual(decideSuggestion({ previous: "low", item: item(5), pendingReason: "low", onList: false }), { type: "withdraw" });
    assert.deepEqual(decideSuggestion({ previous: "low", item: item(5), pendingReason: null, onList: false }), { type: "none" });
  });
});

describe("cantidad sugerida", () => {
  test("lo que falta para llegar al mínimo, al menos 1", () => {
    assert.equal(suggestedQuantity({ quantity: 1, minThreshold: 6 }), 5);
    assert.equal(suggestedQuantity({ quantity: 0, minThreshold: 0 }), 1);
    assert.equal(suggestedQuantity({ quantity: 3, minThreshold: 2 }), 1);
  });
});

describe("estimación de la lista", () => {
  const summary = (amountCents: number, currency: PriceRecord["currency"] = "ARS"): PriceSummary => {
    const record: PriceRecord = { id: "p", itemId: "i", amountCents, currency, store: "", at: 0, createdBy: "x" };
    return { latest: record, cheapest: record, change: null, count: 1 };
  };

  test("suma último precio × cantidad, por moneda, y cuenta cuántos tienen precio", () => {
    const prices = new Map([
      ["leche", summary(150_000)],
      ["yerba", summary(300_000)],
      ["vino", summary(1_200, "USD")],
    ]);
    const estimate = estimateList(
      [
        { quantity: 2, inventoryItemId: "leche" },
        { quantity: 1, inventoryItemId: "yerba" },
        { quantity: 1, inventoryItemId: "vino" },
        { quantity: 3 }, // suelto, sin precio
      ],
      prices,
    );
    assert.deepEqual(estimate.totals, [
      { currency: "ARS", cents: 600_000 },
      { currency: "USD", cents: 1_200 },
    ]);
    assert.equal(estimate.priced, 3);
    assert.equal(estimate.count, 4);
  });

  test("lista vacía", () => {
    assert.deepEqual(estimateList([], new Map()), { totals: [], priced: 0, count: 0 });
  });
});

describe("anotar en la lista", () => {
  test("valida nombre, cantidad y unidad", () => {
    assert.deepEqual(parseNewShoppingItem({ name: " Velas ", quantity: 1, unit: "unidades" }), { name: "Velas", quantity: 1, unit: "unidades", inventoryItemId: undefined });
    assert.throws(() => parseNewShoppingItem({ name: "", quantity: 1, unit: "unidades" }), ValidationError);
    assert.throws(() => parseNewShoppingItem({ name: "Velas", quantity: 0, unit: "unidades" }), ValidationError);
    assert.throws(() => parseNewShoppingItem({ name: "Velas", quantity: 1, unit: "toneladas" }), ValidationError);
  });
});
