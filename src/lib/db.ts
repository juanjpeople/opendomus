import Dexie, { type EntityTable, type Transaction } from "dexie";
import type { ActivityEntry } from "@/features/activity/domain";
import type { CalendarEvent } from "@/features/calendar/domain";
import type { InventoryItem } from "@/features/inventory/domain";
import { DEFAULT_MEMBERS, type Member } from "@/features/members/domain";
import type { PriceRecord } from "@/features/prices/domain";
import type { Container, Space } from "@/features/storage/domain";
import { buildDefaultStorage } from "@/features/storage/seed";

/**
 * Base de datos local (IndexedDB). Solo los servicios (`src/features/<x>/service.ts`)
 * deberían importar `db` para escribir; la UI lee a través de hooks.
 *
 * Cambios de esquema: NUNCA editar una versión existente. Agregar `db.version(n + 1)`
 * con el esquema nuevo y, si hace falta, un `.upgrade()` que migre los datos.
 */

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  isCompleted: boolean;
  /** Si vino automáticamente del inventario. */
  inventoryItemId?: string;
  createdAt: number;
}

export const db = new Dexie("OpenDomusDB") as Dexie & {
  inventory: EntityTable<InventoryItem, "id">;
  shoppingList: EntityTable<ShoppingListItem, "id">;
  activity: EntityTable<ActivityEntry, "id">;
  spaces: EntityTable<Space, "id">;
  containers: EntityTable<Container, "id">;
  prices: EntityTable<PriceRecord, "id">;
  members: EntityTable<Member, "id">;
  events: EntityTable<CalendarEvent, "id">;
};

// Solo se declaran los campos indexados (los usados en `where`/`orderBy`).
db.version(1).stores({
  inventory: "id, name, inventoryType, quantity",
  shoppingList: "id, name, isCompleted, inventoryItemId",
});

// v2: historial de acciones.
db.version(2).stores({
  activity: "id, at, [module+at], [entityId+at]",
});

// v3: lugares (recintos → contenedores) y precios. Los productos pasan de un tipo fijo
// (alacena/taller) a un contenedor; `&code` garantiza códigos de etiqueta únicos.
db.version(3)
  .stores({
    inventory: "id, name, containerId, quantity",
    spaces: "id, name",
    containers: "id, spaceId, &code, name",
    prices: "id, itemId, [itemId+at], store",
    activity: "id, at, [containerId+at], [entityId+at]",
  })
  .upgrade(async (tx) => {
    const { legacy, placeName } = await seedStorage(tx);

    await tx
      .table("inventory")
      .toCollection()
      .modify((item: InventoryItem & { inventoryType?: string }) => {
        item.containerId = item.inventoryType === "taller" ? legacy.taller : legacy.alacena;
        delete item.inventoryType;
      });

    await tx
      .table("activity")
      .toCollection()
      .modify((entry: Omit<ActivityEntry, "module"> & { module: string }) => {
        if (!entry.module.startsWith("inventory.")) return;
        const containerId = entry.module === "inventory.taller" ? legacy.taller : legacy.alacena;
        entry.module = "inventory";
        entry.containerId = containerId;
        entry.place = placeName(containerId);
      });
  });

// v4: contenedores anidados (placard → puerta → cajón). Sin migración de datos:
// los contenedores existentes no tienen `parentId`, o sea, están directo en su recinto.
db.version(4).stores({
  containers: "id, spaceId, parentId, &code, name",
});

// v5: miembros de la casa (antes eran fijos en el código) y calendario compartido.
// Los perfiles fijos se migran con los MISMOS ids: la sesión y el historial siguen funcionando.
db.version(5)
  .stores({
    members: "id, name",
    events: "id, start, repeat",
  })
  .upgrade((tx) => seedMembers(tx));

// v6: recupera casas que quedaron totalmente vacías al fallar el populate por HTTP.
db.version(6)
  .stores({})
  .upgrade(async (tx) => {
    const counts = await Promise.all(tx.storeNames.map((name) => tx.table(name).count()));
    if (counts.some((count) => count > 0)) return;
    await seedStorage(tx);
    await seedMembers(tx);
  });

/** Casa nueva: arranca con lugares de ejemplo (Cocina con Heladera y Alacena, Taller) y los perfiles base. */
db.on("populate", async (tx) => {
  await seedStorage(tx);
  await seedMembers(tx);
});

async function seedMembers(tx: Transaction) {
  const now = Date.now();
  await tx.table("members").bulkAdd(DEFAULT_MEMBERS.map((member) => ({ ...member, createdAt: now, updatedAt: now })));
}

async function seedStorage(tx: Transaction) {
  const seed = buildDefaultStorage();
  await tx.table("spaces").bulkAdd(seed.spaces);
  await tx.table("containers").bulkAdd(seed.containers);
  return seed;
}
