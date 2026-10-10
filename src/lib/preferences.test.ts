import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_PREFERENCES, isValidPreference, sanitizePreferences } from "./preferences";

test("la vista de inventario se recuerda solo si es una conocida", () => {
  assert.equal(DEFAULT_PREFERENCES.inventoryView, "plan");
  assert.equal(DEFAULT_PREFERENCES.spaceView, "plan");
  assert.equal(isValidPreference("inventoryView", "cards"), true);
  assert.equal(isValidPreference("inventoryView", "mosaico"), false);
  // Dentro de un recinto no hay "Lugares": ya estás en uno.
  assert.equal(isValidPreference("spaceView", "places"), false);
  assert.deepEqual(sanitizePreferences({ inventoryView: "list", spaceView: "places", themeMode: "dark", extra: 1 }), { inventoryView: "list", themeMode: "dark" });
  assert.deepEqual(sanitizePreferences(null), {});
});

test("densidades, productos agotados y bloques ocultos se validan", () => {
  assert.equal(DEFAULT_PREFERENCES.headerDensity, "comfortable");
  assert.equal(DEFAULT_PREFERENCES.showEmptyItems, false);
  assert.deepEqual(DEFAULT_PREFERENCES.hiddenWidgets, []);
  assert.equal(isValidPreference("headerDensity", "compact"), true);
  assert.equal(isValidPreference("showEmptyItems", "sí"), false);
  assert.equal(isValidPreference("hiddenWidgets", ["inventory.restock"]), true);
  assert.equal(isValidPreference("hiddenWidgets", ["inventory.restock", "otro"]), false);
});
