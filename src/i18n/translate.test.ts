import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { en } from "./messages/en";
import { es } from "./messages/es";
import { getTranslator } from "./translate";

/** Todas las claves hoja de un diccionario ("shopping.list.title", "home.attention"…). */
function keys(node: unknown, prefix = ""): string[] {
  if (typeof node === "string") return [prefix];
  const record = node as Record<string, unknown>;
  // Un plural ({ one, other }) es una sola clave.
  if (typeof record.other === "string") return [prefix];
  return Object.entries(record).flatMap(([key, value]) => keys(value, prefix ? `${prefix}.${key}` : key));
}

describe("traductor", () => {
  const t = getTranslator("es");

  test("interpola parámetros y deja los que faltan a la vista", () => {
    assert.equal(t("home.hello", { greeting: "Buen día", name: "Ana" }), "Buen día, Ana");
    assert.equal(t("home.hello", { greeting: "Hola" }), "Hola, {name}");
  });

  test("el nombre de la marca sale de {app}, sin pasarlo en cada texto", () => {
    assert.equal(t("common.appName"), "Refugiar");
    assert.equal(t("prices.emptyText"), "Registrá lo que pagaste o viste y Refugiar te muestra el más barato.");
  });

  test("elige el plural según count", () => {
    assert.equal(t("home.attention", { count: 1 }), "1 cosa necesita atención");
    assert.equal(t("home.attention", { count: 3 }), "3 cosas necesitan atención");
    assert.equal(getTranslator("en")("home.attention", { count: 1 }), "1 thing needs attention");
  });

  test("una clave inexistente se devuelve tal cual (se nota, no rompe)", () => {
    assert.equal(t("no.existe" as never), "no.existe");
  });
});

describe("diccionarios", () => {
  test("inglés tiene exactamente las mismas claves que español", () => {
    const esKeys = new Set(keys(es));
    const enKeys = new Set(keys(en));
    assert.deepEqual([...esKeys].filter((key) => !enKeys.has(key)), [], "faltan en inglés");
    assert.deepEqual([...enKeys].filter((key) => !esKeys.has(key)), [], "sobran en inglés");
  });

  test("los mismos {parámetros} en los dos idiomas", () => {
    const params = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    const lookup = (dict: unknown, key: string) => key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], dict);
    for (const key of keys(es)) {
      const esValue = lookup(es, key);
      const enValue = lookup(en, key);
      const flat = (value: unknown) => (typeof value === "string" ? value : Object.values(value as Record<string, string>).join(" "));
      assert.deepEqual([...new Set(params(flat(enValue)))], [...new Set(params(flat(esValue)))], key);
    }
  });
});
