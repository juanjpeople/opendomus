import assert from "node:assert/strict";
import { test } from "node:test";
import { getTranslator } from "@/i18n/translate";
import { getFormatters } from "@/i18n/format";
import { formatQuantity, formatUnit } from "./format";

test("cantidades: singular, cero, decimales y unidades propias en ambos idiomas", () => {
  const es = getTranslator("es"), en = getTranslator("en");
  assert.equal(formatQuantity(es, 1, "unidades", getFormatters("es").number), "1 unidad");
  assert.equal(formatQuantity(en, 1, "unidades", getFormatters("en").number), "1 unit");
  assert.equal(formatQuantity(es, 0, "unidades", getFormatters("es").number), "0 unidades");
  assert.equal(formatQuantity(en, 0, "unidades", getFormatters("en").number), "0 units");
  assert.equal(formatQuantity(es, 1.5, "litros", getFormatters("es").number), "1,5 litros");
  assert.equal(formatQuantity(en, 1.5, "litros", getFormatters("en").number), "1.5 liters");
  assert.equal(formatUnit(es, 1, "pizca"), "pizca");
  assert.equal(formatQuantity(en, 2, undefined, getFormatters("en").number), "2");
});
