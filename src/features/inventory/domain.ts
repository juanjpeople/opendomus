/**
 * Dominio de inventarios: tipos, reglas y validación. Sin React ni base de datos,
 * así se puede usar igual en la UI, en los servicios y (a futuro) en el servidor.
 */
import { ValidationError } from "@/lib/errors";

/** Las unidades se guardan con este identificador y se traducen al mostrarse (`inventory.units.<id>`). */
export const UNITS = ["unidades", "kg", "gr", "litros", "paquetes", "cajas", "metros"] as const;
export type Unit = (typeof UNITS)[number];

export function isUnit(value: string): value is Unit {
  return (UNITS as readonly string[]).includes(value);
}

export interface InventoryItem {
  id: string;
  name: string;
  /** Contenedor donde está guardado (heladera, alacena, caja…). */
  containerId: string;
  quantity: number;
  /** Por debajo de este valor, el ítem está en "stock bajo" (y a futuro va a la lista de compras). */
  minThreshold: number;
  unit: string;
  createdAt: number;
  updatedAt: number;
}

export type NewInventoryItem = Pick<InventoryItem, "name" | "quantity" | "unit" | "minThreshold">;

/** Campos editables de un producto. Cambiar `containerId` es moverlo de lugar. */
export type InventoryItemPatch = Partial<Pick<InventoryItem, "name" | "unit" | "minThreshold" | "containerId">>;

export const INVENTORY_LIMITS = {
  nameMaxLength: 80,
  maxQuantity: 100_000,
} as const;

// --- Estado de stock ---------------------------------------------------------

export type StockStatus = "ok" | "low" | "empty";

/** Color semántico por estado. La etiqueta se traduce con `inventory.stock.<estado>`. */
export const STOCK_STATUS_META: Record<StockStatus, { color: "success" | "warning" | "error" }> = {
  ok: { color: "success" },
  low: { color: "warning" },
  empty: { color: "error" },
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

function parseName(input: string | undefined) {
  const name = input?.trim() ?? "";
  if (!name) throw new ValidationError("errors.validation.nameRequired");
  if (name.length > INVENTORY_LIMITS.nameMaxLength) {
    throw new ValidationError("errors.validation.nameTooLong", { max: INVENTORY_LIMITS.nameMaxLength });
  }
  return name;
}

/** Normaliza y valida la entrada. Los formularios validan para UX; esto es lo que vale. */
export function parseNewInventoryItem(input: NewInventoryItem): NewInventoryItem {
  const name = parseName(input.name);
  if (!isValidAmount(input.quantity)) throw new ValidationError("errors.validation.quantityInvalid");
  if (!isValidAmount(input.minThreshold)) throw new ValidationError("errors.validation.minInvalid");
  if (!isUnit(input.unit)) throw new ValidationError("errors.validation.unitInvalid");
  return { name, quantity: input.quantity, unit: input.unit, minThreshold: input.minThreshold };
}

export function parseInventoryPatch(patch: InventoryItemPatch): InventoryItemPatch {
  const out: InventoryItemPatch = {};
  if (patch.name !== undefined) out.name = parseName(patch.name);
  if (patch.minThreshold !== undefined) {
    if (!isValidAmount(patch.minThreshold)) throw new ValidationError("errors.validation.minInvalid");
    out.minThreshold = patch.minThreshold;
  }
  if (patch.unit !== undefined) {
    if (!isUnit(patch.unit)) throw new ValidationError("errors.validation.unitInvalid");
    out.unit = patch.unit;
  }
  if (patch.containerId !== undefined) out.containerId = patch.containerId;
  return out;
}
