import assert from "node:assert/strict";
import { test } from "node:test";
import { BASIC_CATALOG, catalogDefaults, searchCatalog } from "./catalog";
import { parseNewInventoryItem } from "./domain";

test("catálogo argentino: búsquedas por alias, sin acentos y con varias palabras", () => {
  assert.equal(searchCatalog("lejia")[0]?.name.es, "Lavandina");
  assert.equal(searchCatalog("  cafe   saquitos ")[0]?.id, "coffee-bags");
  assert.equal(searchCatalog("perfume piso")[0]?.id, "floor-cleaner");
  assert.equal(searchCatalog("brocas metal")[0]?.name.es, "Mechas para metal");
  assert.equal(searchCatalog("sugar")[0]?.name.en, "Sugar");
  assert.equal(searchCatalog("arroz", "tools").length, 0);
});

test("todas las plantillas son válidas, tienen identidad única y no crean stock por sí solas", () => {
  assert.equal(new Set(BASIC_CATALOG.map((entry) => entry.id)).size, BASIC_CATALOG.length);
  for (const entry of BASIC_CATALOG) for (const locale of ["es", "en"] as const) {
    const defaults = parseNewInventoryItem(catalogDefaults(entry, locale));
    assert.equal(defaults.autoSuggest, !entry.durable);
    assert.equal(defaults.reusable, entry.durable);
    if (entry.durable) assert.equal(defaults.minThreshold, 0);
    assert.ok(defaults.name.length > 0);
  }
});
