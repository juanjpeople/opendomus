import assert from "node:assert/strict";
import { test } from "node:test";
import { indexStorage, searchStorage } from "./search";
import { cameraContents } from "./camera-content";
import type { Container, ContainerContent, Space } from "./domain";
import type { InventoryItem } from "@/features/inventory/domain";

const spaces: Space[] = [{ id: "shed", name: "Galpón", kind: "shed", createdAt: 1, updatedAt: 1 }];
const containers: Container[] = [
  { id: "shelf", name: "Estante", kind: "shelf", spaceId: "shed", code: "K7QM", createdAt: 1, updatedAt: 1 },
  { id: "box", name: "Repuestos", kind: "basket", spaceId: "shed", parentId: "shelf", code: "B2CD", createdAt: 1, updatedAt: 1 },
];
const notes: ContainerContent[] = [{ id: "note", containerId: "box", text: "Piezas del lavarropas viejo", createdBy: "admin", createdAt: 1, updatedAt: 1 }];
const items: InventoryItem[] = [{ id: "bit", containerId: "box", name: "Mechas de acero", quantity: 3, minThreshold: 0, unit: "unidades", createdAt: 1, updatedAt: 1 }];

test("encuentra cosas sin stock y productos, con la ubicación anidada y sin duplicados", () => {
  const index = indexStorage(spaces, containers, items, notes);
  const result = searchStorage(index, "galpon lavarropas");
  assert.equal(result.length, 1);
  assert.equal(result[0].path, "Galpón › Estante › Repuestos");
  assert.equal(searchStorage(index, "mechas")[0].container.id, "box");
  assert.equal(searchStorage(index, "b2cd")[0].container.id, "box");
  assert.equal(searchStorage(index, "estante").length, 2);
  assert.deepEqual(searchStorage(index, "  "), []);
  assert.deepEqual(searchStorage(index, "inexistente"), []);
});

test("la cámara de una estantería incluye los productos y notas de sus cajas", () => {
  const content = cameraContents("shelf", containers, items, notes, "");
  assert.equal(content.items[0].name, "Mechas de acero");
  assert.equal(content.notes[0].text, "Piezas del lavarropas viejo");
  assert.equal(cameraContents("shelf", containers, items, notes, "lavarropas").items.length, 0);
  assert.equal(cameraContents("box", containers, items, notes, "acero").items.length, 1);
});
