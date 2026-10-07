import assert from "node:assert/strict";
import { test } from "node:test";
import { highlightSearch } from "./search";

test("el resaltado conserva tildes y espacios al encontrar varias palabras", () => {
  assert.deepEqual(highlightSearch("Cajón  de cerámica", "  CAJON ceramica "), [
    { text: "Cajón", matched: true }, { text: "  de ", matched: false }, { text: "cerámica", matched: true },
  ]);
});
test("el resaltado conserva Unicode descompuesto, emojis y coincidencias superpuestas", () => {
  const text = "📦 Cafe\u0301 banana";
  const parts = highlightSearch(text, "cafe ana");
  assert.equal(parts.map((part) => part.text).join(""), text);
  assert.deepEqual(parts.filter((part) => part.matched).map((part) => part.text), ["Cafe\u0301", "anana"]);
});
test("el resaltado trata puntuación como texto y no crea coincidencias para una consulta vacía", () => {
  assert.deepEqual(highlightSearch("Caja [A]", "[A]"), [{ text: "Caja ", matched: false }, { text: "[A]", matched: true }]);
  assert.deepEqual(highlightSearch("Caja", " "), [{ text: "Caja", matched: false }]);
});
