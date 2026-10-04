import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ValidationError } from "@/lib/errors";
import { getStockStatus, parseInventoryPatch, parseNewInventoryItem, planConsumption } from "./domain";

describe("estado de stock", () => {
  test("agotado, bajo y en stock", () => {
    assert.equal(getStockStatus({ quantity: 0, minThreshold: 2 }), "empty");
    assert.equal(getStockStatus({ quantity: 1, minThreshold: 2 }), "low");
    assert.equal(getStockStatus({ quantity: 2, minThreshold: 2 }), "ok");
    // Sin mínimo, solo "agotado" importa.
    assert.equal(getStockStatus({ quantity: 0, minThreshold: 0 }), "empty");
    assert.equal(getStockStatus({ quantity: 1, minThreshold: 0 }), "ok");
  });
});

describe("consumo", () => {
  test("descuenta lo pedido si alcanza", () => {
    assert.deepEqual(planConsumption(5, 2), { quantity: 3, consumed: 2, missing: 0 });
  });

  test("nunca deja negativos: descuenta hasta 0 y avisa cuánto faltó", () => {
    assert.deepEqual(planConsumption(1, 3), { quantity: 0, consumed: 1, missing: 2 });
    assert.deepEqual(planConsumption(0, 1), { quantity: 0, consumed: 0, missing: 1 });
  });

  test("solo cantidades enteras positivas", () => {
    for (const amount of [0, -1, 1.5, Number.NaN, 1_000_000]) {
      assert.throws(() => planConsumption(5, amount), ValidationError, String(amount));
    }
  });
});

describe("validación de productos", () => {
  test("normaliza el nombre", () => {
    assert.equal(parseNewInventoryItem({ name: "  Leche  ", quantity: 1, minThreshold: 0, unit: "litros" }).name, "Leche");
  });

  test("rechaza datos inválidos", () => {
    assert.throws(() => parseNewInventoryItem({ name: " ", quantity: 1, minThreshold: 0, unit: "litros" }), ValidationError);
    assert.throws(() => parseNewInventoryItem({ name: "x".repeat(81), quantity: 1, minThreshold: 0, unit: "litros" }), ValidationError);
    assert.throws(() => parseNewInventoryItem({ name: "Leche", quantity: -1, minThreshold: 0, unit: "litros" }), ValidationError);
    assert.throws(() => parseNewInventoryItem({ name: "Leche", quantity: 1, minThreshold: 0, unit: "galones" }), ValidationError);
  });

  test("un parche solo trae lo que cambia", () => {
    assert.deepEqual(parseInventoryPatch({ autoSuggest: false }), { autoSuggest: false });
    assert.deepEqual(parseInventoryPatch({ name: " Yerba ", minThreshold: 2 }), { name: "Yerba", minThreshold: 2 });
  });
});
