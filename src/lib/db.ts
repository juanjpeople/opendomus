import Dexie, { type EntityTable } from 'dexie';

interface InventoryItem {
  id: string;
  name: string;
  inventoryType: 'alacena' | 'taller'; // Permite separar pañoles
  quantity: number;
  minThreshold: number; // Umbral para mandar automático a lista de compras
  unit: string; // ej. 'kg', 'unidades', 'metros'
  createdAt: number;
  updatedAt: number;
}

interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  isCompleted: boolean;
  inventoryItemId?: string; // Si vino automáticamente del inventario
  createdAt: number;
}

// Inicialización de la base de datos offline-first
const db = new Dexie('OpenDomusDB') as Dexie & {
  inventory: EntityTable<InventoryItem, 'id'>;
  shoppingList: EntityTable<ShoppingListItem, 'id'>;
};

// Declaración del esquema (tablas y campos indexados para búsqueda rápida)
db.version(1).stores({
  inventory: 'id, name, inventoryType, quantity',
  shoppingList: 'id, name, isCompleted, inventoryItemId'
});

export type { InventoryItem, ShoppingListItem };
export { db };
