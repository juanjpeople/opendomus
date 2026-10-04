import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ValidationError } from "@/lib/errors";
import { parseNewPrice, summarizePrices, type PriceRecord } from "./domain";

const price = (amountCents: number, at: number, store = "", currency: PriceRecord["currency"] = "ARS"): PriceRecord => ({
  id: `${at}`,
  itemId: "leche",
  amountCents,
  currency,
  store,
  at,
  createdBy: "u",
});

describe("resumen de precios", () => {
  test("último, más barato y variación contra el anterior", () => {
    const summary = summarizePrices([price(1_450_00, 1, "Coto"), price(1_290_00, 2, "Día"), price(1_500_00, 3, "Coto")])!;
    assert.equal(summary.latest.amountCents, 1_500_00);
    assert.equal(summary.cheapest.store, "Día");
    assert.ok(Math.abs(summary.change! - (1_500_00 - 1_290_00) / 1_290_00) < 1e-9);
    assert.equal(summary.count, 3);
  });

  test("solo compara precios de la moneda del último", () => {
    const summary = summarizePrices([price(100, 1, "", "USD"), price(90_000, 2)])!;
    assert.equal(summary.cheapest.currency, "ARS");
    assert.equal(summary.change, null);
  });

  test("sin precios no hay resumen", () => {
    assert.equal(summarizePrices([]), null);
  });
});

describe("validación de precios", () => {
  test("guarda centavos enteros", () => {
    assert.equal(parseNewPrice({ itemId: "x", amount: 12.345, currency: "ARS", store: " Coto ", at: 0 }).amountCents, 1235);
    assert.equal(parseNewPrice({ itemId: "x", amount: 1, currency: "ARS", store: " Coto ", at: 0 }).store, "Coto");
  });

  test("rechaza montos, monedas y fechas inválidas", () => {
    assert.throws(() => parseNewPrice({ itemId: "x", amount: 0, currency: "ARS", store: "", at: 0 }), ValidationError);
    assert.throws(() => parseNewPrice({ itemId: "x", amount: 1, currency: "XXX" as never, store: "", at: 0 }), ValidationError);
    assert.throws(() => parseNewPrice({ itemId: "x", amount: 1, currency: "ARS", store: "", at: Date.now() + 3 * 86_400_000 }), ValidationError);
  });
});
