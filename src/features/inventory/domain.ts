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
  /** Si al quedar poco entra solo en "Para revisar" de la lista de compras. Sin definir = sí. */
  autoSuggest?: boolean;
  /** Herramientas y equipos: usarlos no descuenta unidades. Ausente = consumible. */
  reusable?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type NewInventoryItem = Pick<InventoryItem, "name" | "quantity" | "unit" | "minThreshold" | "autoSuggest" | "reusable">;

/** Campos editables de un producto. Cambiar `containerId` es moverlo de lugar. */
export type InventoryItemPatch = Partial<Pick<InventoryItem, "name" | "unit" | "minThreshold" | "containerId" | "autoSuggest" | "reusable">>;

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

/**
 * Una herramienta o equipo (`reusable`) no se gasta: o lo tenés o no. Nunca está "bajo",
 * aunque tenga un mínimo cargado de antes.
 */
export function getStockStatus({ quantity, minThreshold, reusable }: Pick<InventoryItem, "quantity" | "minThreshold"> & Partial<Pick<InventoryItem, "reusable">>): StockStatus {
  if (quantity <= 0) return "empty";
  if (!reusable && quantity < minThreshold) return "low";
  return "ok";
}

/** ¿Va a "Para reponer"? Solo los insumos bajos o agotados: una pala o una pinza no se reponen. */
export function needsRestock(item: Pick<InventoryItem, "quantity" | "minThreshold" | "reusable">): boolean {
  return !item.reusable && getStockStatus(item) !== "ok";
}

/** ¿Se muestra en las listas? Lo que no tenés (cantidad 0) mete ruido salvo que el perfil pida verlo. */
export function isInStock(item: Pick<InventoryItem, "quantity">): boolean {
  return item.quantity > 0;
}

export interface InventorySummary {
  /** Insumos con cantidad: lo que se gasta y hoy está en casa. */
  supplies: number;
  /** Herramientas y equipos que tenés. */
  tools: number;
  /** Insumos por debajo del mínimo (todavía hay). */
  low: number;
  /** Insumos en 0. */
  empty: number;
}

/** Totales que importan: separa insumos de herramientas y no cuenta como faltante lo que no se repone. */
export function summarizeInventory(items: Pick<InventoryItem, "quantity" | "minThreshold" | "reusable">[]): InventorySummary {
  const summary: InventorySummary = { supplies: 0, tools: 0, low: 0, empty: 0 };
  for (const item of items) {
    if (item.reusable) {
      if (isInStock(item)) summary.tools++;
      continue;
    }
    const status = getStockStatus(item);
    if (status === "empty") summary.empty++;
    else summary.supplies++;
    if (status === "low") summary.low++;
  }
  return summary;
}

// --- Ritmo de uso ------------------------------------------------------------

/** Ventana del historial para calcular el ritmo de uso. */
export const USAGE_WINDOW_DAYS = 30;

export interface UsageForecast {
  /** Unidades usadas en la ventana. */
  used: number;
  /** Veces que se registró un uso. */
  times: number;
  /** Días que alcanza lo que queda a este ritmo. `null` si no se puede estimar. */
  daysLeft: number | null;
}

/**
 * Cuánto dura lo que queda al ritmo de los últimos 30 días. Sin usos no hay ritmo: no se inventa
 * un número. Con el primer uso de hace poco, el ritmo se mide desde ese día (no diluido en 30).
 */
export function forecastUsage(quantity: number, uses: { at: number; amount: number }[], now: number): UsageForecast {
  const DAY = 86_400_000;
  const since = now - USAGE_WINDOW_DAYS * DAY;
  const inWindow = uses.filter((use) => use.at >= since && use.at <= now && use.amount > 0);
  const used = inWindow.reduce((sum, use) => sum + use.amount, 0);
  if (!used) return { used: 0, times: 0, daysLeft: null };
  const first = Math.min(...inWindow.map((use) => use.at));
  // Al menos una semana de base: dos usos en un día no son "uno por hora".
  const days = Math.max(7, (now - first) / DAY);
  const perDay = used / days;
  return { used, times: inWindow.length, daysLeft: Math.floor(quantity / perDay) };
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
  return { name, quantity: input.quantity, unit: input.unit, minThreshold: input.minThreshold,
    ...(input.autoSuggest === undefined ? {} : { autoSuggest: !!input.autoSuggest }),
    ...(input.reusable === undefined ? {} : { reusable: !!input.reusable }) };
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
  if (patch.autoSuggest !== undefined) out.autoSuggest = !!patch.autoSuggest;
  if (patch.reusable !== undefined) out.reusable = !!patch.reusable;
  return out;
}

// --- Consumo -----------------------------------------------------------------

export interface ConsumptionPlan {
  /** Cantidad que queda después de consumir. */
  quantity: number;
  /** Lo que de verdad se descontó (nunca más de lo que había). */
  consumed: number;
  /** Lo que faltó para cubrir el pedido (0 si alcanzó). */
  missing: number;
}

/** Cuánto se descuenta al consumir `amount`. Nunca deja negativos: si no alcanza, descuenta hasta 0. */
export function planConsumption(current: number, amount: number): ConsumptionPlan {
  if (!Number.isInteger(amount) || amount <= 0 || amount > INVENTORY_LIMITS.maxQuantity) {
    throw new ValidationError("errors.validation.quantityInvalid");
  }
  const consumed = Math.min(current, amount);
  return { quantity: current - consumed, consumed, missing: amount - consumed };
}
