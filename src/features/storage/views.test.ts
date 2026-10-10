import assert from "node:assert/strict";
import { test } from "node:test";
import type { ContainerOverview, SpaceOverview } from "./hooks";
import { entryPath, flattenOverview, listRows, placeShortcuts, sortEntries, spaceTotals } from "./views";

function node(id: string, name: string, stats: Partial<ContainerOverview> = {}, children: ContainerOverview[] = [], depth = 1): ContainerOverview {
  return {
    id, name, kind: "box", spaceId: "taller", code: "K7QM", createdAt: 1, updatedAt: 1,
    itemCount: 0, needsAttention: 0, low: 0, empty: 0, contentCount: 0, photoCount: 0, preview: [], depth, children, ...stats,
  };
}

const drawer = node("cajon", "Cajón de tornillos", { itemCount: 2, needsAttention: 1, low: 1 }, [], 2);
const shelf = node("estanteria", "Estantería", { itemCount: 5, needsAttention: 1, low: 1 }, [drawer]);
const box = node("caja", "Caja de cables", { contentCount: 3 });
const toolbox = node("herramientas", "Caja de herramientas", { itemCount: 4, needsAttention: 2, empty: 2 });
const taller: SpaceOverview = { id: "taller", name: "Taller", kind: "workshop", createdAt: 1, updatedAt: 1, containers: [shelf, box, toolbox] };

test("el árbol se aplana con su ruta, padre antes que hijos", () => {
  const entries = flattenOverview([taller]);
  assert.deepEqual(entries.map((entry) => entry.container.id), ["estanteria", "cajon", "caja", "herramientas"]);
  assert.equal(entryPath(entries[1]), "Taller › Estantería");
  assert.equal(entryPath(entries[0]), "Taller");
});

test("los totales del recinto cuentan todos los niveles sin duplicar productos", () => {
  // Los productos y alertas de cada contenedor ya incluyen sus compartimentos.
  assert.deepEqual(spaceTotals(taller), { containers: 4, items: 9, attention: 3 });
});

test("las tarjetas se ordenan por nombre, por cantidad o por alertas", () => {
  const entries = flattenOverview([taller]);
  assert.deepEqual(sortEntries(entries, "name").map((entry) => entry.container.name), ["Caja de cables", "Caja de herramientas", "Cajón de tornillos", "Estantería"]);
  assert.equal(sortEntries(entries, "items")[0].container.id, "estanteria");
  assert.equal(sortEntries(entries, "alerts")[0].container.id, "herramientas");
});

test("el mini plano muestra primero lo que necesita atención y resume el resto", () => {
  const many: SpaceOverview = { ...taller, containers: Array.from({ length: 9 }, (_, index) => node(`c${index}`, `Caja ${index}`, { needsAttention: index === 8 ? 1 : 0 })) };
  const { shown, more } = placeShortcuts(many);
  assert.equal(shown.length, 4);
  assert.equal(shown[0].id, "c8");
  assert.equal(more, 5);
  // Si sobra uno solo, se muestra en lugar de "+1".
  const five: SpaceOverview = { ...taller, containers: many.containers.slice(0, 5) };
  assert.deepEqual([placeShortcuts(five).shown.length, placeShortcuts(five).more], [5, 0]);
});

test("la lista pliega los compartimentos de un contenedor", () => {
  const open = listRows(taller, new Set());
  assert.equal(open.length, 4);
  assert.deepEqual(open.map((row) => row.depth), [1, 2, 1, 1]);
  assert.equal(open[0].expandable, true);
  assert.equal(open[0].expanded, true);
  const folded = listRows(taller, new Set(["estanteria"]));
  assert.deepEqual(folded.map((row) => row.container.id), ["estanteria", "caja", "herramientas"]);
  assert.equal(folded[0].expanded, false);
});
