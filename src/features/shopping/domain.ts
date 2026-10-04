/**
 * Lista de compras: lo que hay que comprar (a mano o confirmado desde "Para revisar") y las
 * sugerencias automáticas que aparecen cuando algo del inventario queda bajo o se agota.
 * Sin React ni base de datos.
 */
import { getStockStatus, INVENTORY_LIMITS, isUnit, type InventoryItem, type StockStatus } from "@/features/inventory/domain";
import type { Currency, PriceSummary } from "@/features/prices/domain";
import { ValidationError } from "@/lib/errors";

export type ShoppingStatus = "pending" | "bought";

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  /** `pending` = falta comprar; `bought` = ya está en la bolsa. (Un booleano no se puede indexar en IndexedDB.) */
  status: ShoppingStatus;
  /** Producto del inventario al que repone (si no, es un ítem suelto: "velas de cumpleaños"). */
  inventoryItemId?: string;
  /** Cuánto se sumó al inventario al comprarlo (para poder desmarcarlo sin dejar stock de más). */
  restocked?: number;
  createdBy: string;
  createdAt: number;
  boughtAt?: number;
  boughtBy?: string;
}

export type SuggestionReason = Exclude<StockStatus, "ok">;
export type SuggestionStatus = "pending" | "confirmed" | "dismissed";

/** Algo que se está acabando y espera que alguien decida si se compra o no. */
export interface ShoppingCandidate {
  id: string;
  itemId: string;
  reason: SuggestionReason;
  status: SuggestionStatus;
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface NewShoppingItem {
  name: string;
  quantity: number;
  unit: string;
  inventoryItemId?: string;
}

export const SHOPPING_LIMITS = {
  nameMaxLength: INVENTORY_LIMITS.nameMaxLength,
  maxQuantity: 10_000,
  /** Lo comprado se ve en la lista hasta que alguien la limpia, o hasta esto. */
  boughtVisibleMs: 7 * 86_400_000,
} as const;

export function parseNewShoppingItem(input: NewShoppingItem): NewShoppingItem {
  const name = input.name?.trim() ?? "";
  if (!name) throw new ValidationError("errors.validation.nameRequired");
  if (name.length > SHOPPING_LIMITS.nameMaxLength) throw new ValidationError("errors.validation.nameTooLong", { max: SHOPPING_LIMITS.nameMaxLength });
  parseShoppingQuantity(input.quantity);
  if (!isUnit(input.unit)) throw new ValidationError("errors.validation.unitInvalid");
  return { name, quantity: input.quantity, unit: input.unit, inventoryItemId: input.inventoryItemId || undefined };
}

export function parseShoppingQuantity(quantity: number): number {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > SHOPPING_LIMITS.maxQuantity) {
    throw new ValidationError("errors.validation.quantityInvalid");
  }
  return quantity;
}

/** Cuánto comprar para volver al mínimo (al menos 1). */
export function suggestedQuantity(item: Pick<InventoryItem, "quantity" | "minThreshold">): number {
  return Math.max(1, item.minThreshold - item.quantity);
}

// --- Sugerencias automáticas ---------------------------------------------------

export type SuggestionChange =
  | { type: "none" }
  | { type: "create"; reason: SuggestionReason }
  | { type: "update"; reason: SuggestionReason }
  | { type: "withdraw" };

interface SuggestionContext {
  /** Estado antes del cambio. `null` si el producto es nuevo. */
  previous: StockStatus | null;
  item: Pick<InventoryItem, "quantity" | "minThreshold" | "autoSuggest">;
  /** Motivo de la sugerencia pendiente que ya tiene, si tiene. */
  pendingReason: SuggestionReason | null;
  /** Si ya está anotado (sin comprar) en la lista. */
  onList: boolean;
}

/**
 * Qué hacer con la sugerencia de un producto después de un cambio de stock.
 * - Entra en "Para revisar" solo al CRUZAR el mínimo (ok → bajo/agotado), así descartar algo
 *   no lo hace volver con el próximo clic, y solo si no está ya pendiente o en la lista.
 * - Si vuelve a tener stock antes de que alguien la revise, la sugerencia se retira sola.
 * - Si estaba "bajo" y se agotó, la sugerencia se actualiza (cambia la urgencia).
 */
export function decideSuggestion({ previous, item, pendingReason, onList }: SuggestionContext): SuggestionChange {
  const status = getStockStatus(item);
  if (status === "ok") return pendingReason ? { type: "withdraw" } : { type: "none" };
  if (pendingReason) return pendingReason === status ? { type: "none" } : { type: "update", reason: status };
  if (previous !== "ok" && previous !== null) return { type: "none" };
  if (item.autoSuggest === false || onList) return { type: "none" };
  return { type: "create", reason: status };
}

// --- Estimación ----------------------------------------------------------------

export interface ShoppingEstimate {
  /** Total por moneda, en centavos (normalmente hay una sola). */
  totals: { currency: Currency; cents: number }[];
  /** Cuántos ítems pendientes tienen precio conocido, de cuántos. */
  priced: number;
  count: number;
}

/** Total estimado de lo pendiente con el último precio conocido de cada producto. */
export function estimateList(items: Pick<ShoppingListItem, "quantity" | "inventoryItemId">[], prices: Map<string, PriceSummary>): ShoppingEstimate {
  const totals = new Map<Currency, number>();
  let priced = 0;
  for (const item of items) {
    const summary = item.inventoryItemId ? prices.get(item.inventoryItemId) : undefined;
    if (!summary) continue;
    priced++;
    const { currency, amountCents } = summary.latest;
    totals.set(currency, (totals.get(currency) ?? 0) + amountCents * item.quantity);
  }
  return {
    totals: [...totals].map(([currency, cents]) => ({ currency, cents })).sort((a, b) => b.cents - a.cents),
    priced,
    count: items.length,
  };
}
