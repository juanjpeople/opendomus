import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { PriceRecord, PriceSummary } from "@/features/prices/domain";
import { summarizeProject } from "@/features/projects/domain";
import { ValidationError } from "@/lib/errors";
import { decideSuggestion, estimateList, HOME_LIST_ID, parseListInput, parseMoney, parseNewShoppingItem, suggestedQuantity, summarizeBudget } from "./domain";

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

  test("una herramienta nunca se sugiere y retira la sugerencia que tenía", () => {
    assert.deepEqual(decideSuggestion({ previous: "ok", item: { quantity: 0, minThreshold: 1, reusable: true }, pendingReason: null, onList: false }), { type: "none" });
    assert.deepEqual(decideSuggestion({ previous: "low", item: { quantity: 0, minThreshold: 1, reusable: true }, pendingReason: "empty", onList: false }), { type: "withdraw" });
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
    // Sin lista va a la de la casa.
    assert.deepEqual(parseNewShoppingItem({ name: " Velas ", quantity: 1, unit: "unidades" }), {
      name: "Velas",
      quantity: 1,
      unit: "unidades",
      inventoryItemId: undefined,
      listId: HOME_LIST_ID,
      estimate: undefined,
    });
    assert.throws(() => parseNewShoppingItem({ name: "", quantity: 1, unit: "unidades" }), ValidationError);
    assert.throws(() => parseNewShoppingItem({ name: "Velas", quantity: 0, unit: "unidades" }), ValidationError);
    assert.throws(() => parseNewShoppingItem({ name: "Velas", quantity: 1, unit: "toneladas" }), ValidationError);
  });
});

describe("presupuesto de una lista", () => {
  const summary = (amountCents: number, currency: PriceRecord["currency"] = "ARS"): PriceSummary => {
    const record: PriceRecord = { id: "p", itemId: "i", amountCents, currency, store: "", at: 0, createdBy: "x" };
    return { latest: record, cheapest: record, change: null, count: 1 };
  };
  const prices = new Map([
    ["inodoro", summary(150_000_00)],
    ["dolares", summary(50_00, "USD")],
  ]);

  test("gastado + comprado sin precio + lo que falta, contra el presupuesto", () => {
    const budget = summarizeBudget({ currency: "ARS", budgetCents: 500_000_00 }, [
      { status: "bought", quantity: 1, paidCents: 160_000_00, paidCurrency: "ARS" }, // pagado
      { status: "bought", quantity: 1, inventoryItemId: "inodoro" }, // comprado sin precio: último precio
      { status: "pending", quantity: 2, estimateCents: 40_000_00 }, // estimado a mano
      { status: "pending", quantity: 1, inventoryItemId: "inodoro", estimateCents: 120_000_00 }, // el estimado manda
      { status: "pending", quantity: 3 }, // sin precio
    ], prices);
    assert.equal(budget.spentCents, 160_000_00);
    assert.equal(budget.boughtEstimateCents, 150_000_00);
    assert.equal(budget.pendingCents, 80_000_00 + 120_000_00);
    assert.equal(budget.totalCents, 510_000_00);
    assert.equal(budget.remainingCents, -10_000_00);
    assert.equal(budget.unpriced, 1);
  });

  test("no mezcla monedas: un precio en dólares no cuenta en una lista en pesos", () => {
    const budget = summarizeBudget({ currency: "ARS" }, [
      { status: "pending", quantity: 1, inventoryItemId: "dolares" },
      { status: "bought", quantity: 1, paidCents: 10_00, paidCurrency: "USD" },
    ], prices);
    assert.equal(budget.totalCents, 0);
    assert.equal(budget.unpriced, 2);
    assert.equal(budget.remainingCents, undefined);
  });

  test("el proyecto suma sus listas de la misma moneda", () => {
    const list = (spentCents: number, pendingCents: number, currency: PriceRecord["currency"] = "ARS") => ({
      currency, spentCents, pendingCents, boughtEstimateCents: 0, unpriced: 0, totalCents: spentCents + pendingCents,
    });
    const project = summarizeProject({ currency: "ARS", budgetCents: 100_00 }, [list(30_00, 20_00), list(40_00, 20_00), list(5_00, 0, "USD")]);
    assert.equal(project.totalCents, 110_00);
    assert.equal(project.remainingCents, -10_00);
    assert.equal(project.otherCurrency, 1);
  });
});

describe("listas", () => {
  test("montos en unidades pasan a centavos; vacío = sin presupuesto", () => {
    assert.equal(parseMoney(1500.5), 150050);
    assert.equal(parseMoney(null), undefined);
    assert.throws(() => parseMoney(-1), ValidationError);
  });

  test("valida nombre, moneda y apariencia", () => {
    const base = { name: "Sanitarios", currency: "ARS" as const, color: "blue" as const, icon: "bath" as const };
    assert.deepEqual(parseListInput({ ...base, budget: 1000 }), { ...base, privacy: "family", projectId: undefined, budgetCents: 100000 });
    assert.equal(parseListInput({ ...base, privacy: "private" }).privacy, "private");
    assert.throws(() => parseListInput({ ...base, name: " " }), ValidationError);
    assert.throws(() => parseListInput({ ...base, icon: "inventado" as never }), ValidationError);
    assert.throws(() => parseListInput({ ...base, privacy: "inventada" as never }), ValidationError);
  });
});
