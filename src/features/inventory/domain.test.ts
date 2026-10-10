import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ValidationError } from "@/lib/errors";
import { forecastUsage, getStockStatus, needsRestock, parseInventoryPatch, parseNewInventoryItem, planConsumption, summarizeInventory } from "./domain";

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

describe("herramientas e insumos", () => {
  test("una herramienta nunca está baja y no va a Para reponer", () => {
    assert.equal(getStockStatus({ quantity: 1, minThreshold: 3, reusable: true }), "ok");
    assert.equal(getStockStatus({ quantity: 0, minThreshold: 3, reusable: true }), "empty");
    assert.equal(needsRestock({ quantity: 0, minThreshold: 3, reusable: true }), false);
    assert.equal(needsRestock({ quantity: 1, minThreshold: 3 }), true);
    assert.equal(needsRestock({ quantity: 3, minThreshold: 3 }), false);
  });

  test("el resumen separa insumos de herramientas y no cuenta herramientas faltantes", () => {
    assert.deepEqual(summarizeInventory([
      { quantity: 4, minThreshold: 2 },
      { quantity: 1, minThreshold: 2 },
      { quantity: 0, minThreshold: 2 },
      { quantity: 1, minThreshold: 0, reusable: true },
      { quantity: 0, minThreshold: 0, reusable: true },
    ]), { supplies: 2, tools: 1, low: 1, empty: 1 });
  });
});

describe("ritmo de uso", () => {
  const DAY = 86_400_000;
  const now = 100 * DAY;

  test("sin usos no inventa un número", () => {
    assert.deepEqual(forecastUsage(5, [], now), { used: 0, times: 0, daysLeft: null });
  });

  test("calcula cuántos días alcanza al ritmo del último mes", () => {
    const uses = [{ at: now - 30 * DAY, amount: 3 }, { at: now - 15 * DAY, amount: 3 }];
    assert.deepEqual(forecastUsage(4, uses, now), { used: 6, times: 2, daysLeft: 20 });
  });

  test("ignora usos fuera de la ventana y mide al menos una semana", () => {
    const uses = [{ at: now - 60 * DAY, amount: 10 }, { at: now - DAY, amount: 7 }];
    assert.deepEqual(forecastUsage(3, uses, now), { used: 7, times: 1, daysLeft: 3 });
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
