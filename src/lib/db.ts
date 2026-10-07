import { DEMO_ENABLED, HOUSE_DB } from "@/lib/demo";
import Dexie, { type EntityTable, type Transaction } from "dexie";
import type { ActivityEntry } from "@/features/activity/domain";
import type { CalendarEvent } from "@/features/calendar/domain";
import type { CalendarSettings } from "@/features/calendar/settings";
import type { Comment } from "@/features/comments/domain";
import type { InventoryItem } from "@/features/inventory/domain";
import type { Photo } from "@/features/media/domain";
import { DEFAULT_MEMBERS, type Member } from "@/features/members/domain";
import type { PriceRecord } from "@/features/prices/domain";
import type { Recipe } from "@/features/recipes/domain";
import type { Project } from "@/features/projects/domain";
import { HOME_LIST_ID, type ShoppingCandidate, type ShoppingList, type ShoppingListItem } from "@/features/shopping/domain";
import type { Container, ContainerContent, Space } from "@/features/storage/domain";
import { buildDefaultStorage } from "@/features/storage/seed";
import type { SyncRecord } from "@/lib/sync/merge";
import { syncMiddleware } from "@/lib/sync/middleware";
import type { PhotoDelete } from "@/lib/sync/photos";
import { CONTAINER_BACKFILL, SETTINGS_BACKFILL } from "@/lib/sync/upgrades";

/**
 * Base de datos local (IndexedDB). Solo los servicios (`src/features/<x>/service.ts`)
 * deberían importar `db` para escribir; la UI lee a través de hooks.
 *
 * Cambios de esquema: NUNCA editar una versión existente. Agregar `db.version(n + 1)`
 * con el esquema nuevo y, si hace falta, un `.upgrade()` que migre los datos.
 */

export const db = new Dexie(HOUSE_DB) as Dexie & {
  inventory: EntityTable<InventoryItem, "id">;
  /** Ítems de todas las listas (el nombre de la tabla es histórico: cada ítem tiene su `listId`). */
  shoppingList: EntityTable<ShoppingListItem, "id">;
  shoppingLists: EntityTable<ShoppingList, "id">;
  projects: EntityTable<Project, "id">;
  shoppingCandidates: EntityTable<ShoppingCandidate, "id">;
  activity: EntityTable<ActivityEntry, "id">;
  spaces: EntityTable<Space, "id">;
  containers: EntityTable<Container, "id">;
  containerContents: EntityTable<ContainerContent, "id">;
  prices: EntityTable<PriceRecord, "id">;
  members: EntityTable<Member, "id">;
  events: EntityTable<CalendarEvent, "id">;
  houseSettings: EntityTable<CalendarSettings, "id">;
  recipes: EntityTable<Recipe, "id">;
  photos: EntityTable<Photo, "id">;
  comments: EntityTable<Comment, "id">;
  /** Sincronización: qué falta subir de cada cosa y hasta dónde se conoce cada campo. */
  syncRecords: EntityTable<SyncRecord, "k">;
  /** Sincronización: hasta dónde se bajó, lo que está en viaje y las claves conocidas de la casa. */
  syncState: EntityTable<SyncStateEntry, "key">;
  /** Borrados de bytes cifrados pendientes de confirmar en R2. */
  photoDeletes: EntityTable<PhotoDelete, "k">;
};

export interface SyncStateEntry {
  key: string;
  value: unknown;
}

/**
 * Historial completo del esquema. Se declara en una función para poder abrir otra base con
 * el esquema de una versión vieja (`upTo`): así un export viejo se importa y las mismas
 * migraciones de acá lo llevan a la versión actual (ver `importAllData`).
 */
export function declareSchema(target: Dexie, upTo = Infinity) {
  // Solo se declaran los campos indexados (los usados en `where`/`orderBy`).
  if (upTo >= 1) target.version(1).stores({
    inventory: "id, name, inventoryType, quantity",
    shoppingList: "id, name, isCompleted, inventoryItemId",
  });

  // v2: historial de acciones.
  if (upTo >= 2) target.version(2).stores({
    activity: "id, at, [module+at], [entityId+at]",
  });

  // v3: lugares (recintos → contenedores) y precios. Los productos pasan de un tipo fijo
  // (alacena/taller) a un contenedor; `&code` garantiza códigos de etiqueta únicos.
  if (upTo >= 3) target.version(3)
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
  if (upTo >= 4) target.version(4).stores({
    containers: "id, spaceId, parentId, &code, name",
  });

  // v5: miembros de la casa (antes eran fijos en el código) y calendario compartido.
  // Los perfiles fijos se migran con los MISMOS ids: la sesión y el historial siguen funcionando.
  if (upTo >= 5) target.version(5)
    .stores({
      members: "id, name",
      events: "id, start, repeat",
    })
    .upgrade((tx) => seedMembers(tx));

  // v6: recupera casas que quedaron totalmente vacías al fallar el populate por HTTP.
  if (upTo >= 6) target.version(6)
    .stores({})
    .upgrade(async (tx) => {
      // Solo las tablas que existen en v6: si la casa salta varias versiones de una, `tx.storeNames`
      // ya trae las de versiones posteriores, que en este paso todavía no se pueden leer.
      const V6_TABLES = ["inventory", "shoppingList", "activity", "spaces", "containers", "prices", "members", "events"];
      const counts = await Promise.all(V6_TABLES.map((name) => tx.table(name).count()));
      if (counts.some((count) => count > 0)) return;
      await seedStorage(tx);
      await seedMembers(tx);
    });

  // v7: lista de compras de verdad. `isCompleted` (booleano, no indexable) pasa a `status`,
  // y nace la bandeja "Para revisar" con las sugerencias automáticas del inventario.
  if (upTo >= 7) target.version(7)
    .stores({
      shoppingList: "id, status, inventoryItemId, createdAt",
      shoppingCandidates: "id, itemId, status, createdAt",
    })
    .upgrade(async (tx) => {
      await tx
        .table("shoppingList")
        .toCollection()
        .modify((entry: ShoppingListItem & { isCompleted?: boolean }) => {
          entry.status = entry.isCompleted ? "bought" : "pending";
          entry.createdBy ??= "";
          delete entry.isCompleted;
        });
    });

  // v8: recetas (con sus ingredientes adentro), y fotos y comentarios genéricos (de cualquier
  // cosa: `ownerType` + `ownerId`). Las fotos son Blobs comprimidos en el dispositivo.
  if (upTo >= 8) target.version(8).stores({
    recipes: "id, name, updatedAt",
    photos: "id, [ownerType+ownerId], createdAt",
    comments: "id, [ownerType+ownerId], createdAt",
  });

  // v9: varias listas de compras (con presupuesto) y proyectos que las agrupan. Todo lo que
  // había pasa a la lista de la casa, que se crea acá y es adonde llegan las sugerencias.
  if (upTo >= 9) target.version(9)
    .stores({
      shoppingList: "id, status, inventoryItemId, createdAt, listId, [listId+status]",
      shoppingLists: "id, projectId, archivedAt",
      projects: "id, status",
    })
    .upgrade(async (tx) => {
      await seedLists(tx);
      await tx.table("shoppingList").toCollection().modify((entry: ShoppingListItem) => {
        entry.listId ??= HOME_LIST_ID;
      });
    });

  // v10: sincronización con la nube (ver `src/lib/sync`). Los miembros guardan su cuenta
  // (`userId`) y el historial, la lista donde pasó (para heredar su privacidad).
  if (upTo >= 10) target.version(10).stores({
    members: "id, name, userId",
    activity: "id, at, [containerId+at], [entityId+at], listId",
    syncRecords: "k, pending",
    syncState: "key",
  });

  // v11: cola durable para borrar de R2 incluso si el dispositivo está offline al eliminar fotos.
  if (upTo >= 11) target.version(11).stores({
    photoDeletes: "k, householdId, requestedAt",
  });
  // v12: contenido libre por contenedor. Las altas de distintos dispositivos no se pisan.
  if (upTo >= 12) target.version(12)
    .stores({ containerContents: "id, containerId, createdAt" })
    .upgrade(async (tx) => {
      // v11 rechazaba operaciones que incluían la tabla desconocida. El motor recupera
      // solo esas operaciones, no vuelve a aplicar consumos ya procesados.
      const cursor = await tx.table("syncState").get("cursor");
      if (typeof cursor?.value === "number" && cursor.value > 0) {
        await tx.table("syncState").put({ key: CONTAINER_BACKFILL, value: cursor.value });
        await tx.table("syncState").delete("cursor");
      }
    });
  // v13: shared calendar location and optional school module. Recover only new-table ops.
  if (upTo >= 13) target.version(13).stores({ houseSettings: "id" }).upgrade(async (tx) => {
    const cursor = await tx.table("syncState").get("cursor");
    const prior = await tx.table("syncState").get(CONTAINER_BACKFILL);
    const through = Math.max(typeof cursor?.value === "number" ? cursor.value : 0, typeof prior?.value === "number" ? prior.value : 0);
    if (through > 0) {
      await tx.table("syncState").put({ key: SETTINGS_BACKFILL, value: through });
      await tx.table("syncState").delete("cursor");
    }
  });
}

declareSchema(db);
// Cada escritura de lo que se sincroniza queda anotada para subirla (solo con la casa en la nube).
db.use(syncMiddleware);

/** Casa nueva: perfiles y lista base. Los espacios y artículos requieren elección explícita. */
db.on("populate", async (tx) => {
  if (DEMO_ENABLED) {
    const { populateDemo } = await Dexie.waitFor(import("@/features/demo/seed"));
    await populateDemo(tx);
    return;
  }
  await seedMembers(tx);
  await seedLists(tx);
});

/** La lista de la casa. Su nombre se muestra traducido (ver `listName`); el guardado es de respaldo. */
async function seedLists(tx: Transaction) {
  const now = Date.now();
  const home: ShoppingList = { id: HOME_LIST_ID, name: "Casa", currency: "ARS", color: "blue", icon: "house", createdBy: "", createdAt: now, updatedAt: now };
  await tx.table("shoppingLists").put(home);
}

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
