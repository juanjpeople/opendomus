/**
 * Dominio de inventarios: tipos, reglas y validación. Sin React ni base de datos,
 * así se puede usar igual en la UI, en los servicios y (a futuro) en el servidor.
 */
import { ValidationError } from "@/lib/errors";

export const INVENTORY_TYPES = {
  alacena: {
    label: "Alacena",
    description: "Alimentos y productos de consumo de la casa.",
    itemNoun: "producto",
    itemNounPlural: "productos",
    units: ["unidades", "kg", "gr", "litros", "paquetes"],
  },
  taller: {
    label: "Taller",
    description: "Herramientas y materiales del taller.",
    itemNoun: "herramienta",
    itemNounPlural: "herramientas",
    units: ["unidades", "cajas", "metros", "litros"],
  },
} as const;

export type InventoryType = keyof typeof INVENTORY_TYPES;

export interface InventoryItem {
  id: string;
  name: string;
  inventoryType: InventoryType;
  quantity: number;
  /** Por debajo de este valor, el ítem está en "stock bajo" (y a futuro va a la lista de compras). */
  minThreshold: number;
  unit: string;
  createdAt: number;
  updatedAt: number;
}

export type NewInventoryItem = Pick<InventoryItem, "name" | "quantity" | "unit" | "minThreshold">;

export const INVENTORY_LIMITS = {
  nameMaxLength: 80,
  maxQuantity: 100_000,
} as const;

// --- Estado de stock ---------------------------------------------------------

export type StockStatus = "ok" | "low" | "empty";

export const STOCK_STATUS_META: Record<StockStatus, { label: string; color: "success" | "warning" | "error" }> = {
  ok: { label: "En stock", color: "success" },
  low: { label: "Stock bajo", color: "warning" },
  empty: { label: "Agotado", color: "error" },
};

export function getStockStatus({ quantity, minThreshold }: Pick<InventoryItem, "quantity" | "minThreshold">): StockStatus {
  if (quantity <= 0) return "empty";
  if (quantity < minThreshold) return "low";
  return "ok";
}

// --- Validación --------------------------------------------------------------

function isValidAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= INVENTORY_LIMITS.maxQuantity;
}

/** Normaliza y valida la entrada. Los formularios validan para UX; esto es lo que vale. */
export function parseNewInventoryItem(type: InventoryType, input: NewInventoryItem): NewInventoryItem {
  const name = input.name?.trim() ?? "";
  if (!name) throw new ValidationError("El nombre es obligatorio.");
  if (name.length > INVENTORY_LIMITS.nameMaxLength) {
    throw new ValidationError(`El nombre no puede superar ${INVENTORY_LIMITS.nameMaxLength} caracteres.`);
  }
  if (!isValidAmount(input.quantity)) throw new ValidationError("La cantidad debe ser un número entero válido.");
  if (!isValidAmount(input.minThreshold)) throw new ValidationError("El mínimo debe ser un número entero válido.");

  const units: readonly string[] = INVENTORY_TYPES[type].units;
  if (!units.includes(input.unit)) throw new ValidationError("Unidad no válida.");

  return { name, quantity: input.quantity, unit: input.unit, minThreshold: input.minThreshold };
}
