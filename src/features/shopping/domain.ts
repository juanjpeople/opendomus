/**
 * Lista de compras: lo que hay que comprar (a mano o confirmado desde "Para revisar") y las
 * sugerencias automáticas que aparecen cuando algo del inventario queda bajo o se agota.
 * Sin React ni base de datos.
 */
import { getStockStatus, INVENTORY_LIMITS, isUnit, type InventoryItem, type StockStatus } from "@/features/inventory/domain";
import { CURRENCIES, type Currency, type PriceSummary } from "@/features/prices/domain";
import { isAppearanceColor, isAppearanceIcon, type AppearanceColor, type AppearanceIcon } from "@/lib/appearance";
import { ValidationError } from "@/lib/errors";
import { isPrivacy, type Privacy } from "@/lib/sync/scope";

// --- Listas ---------------------------------------------------------------------

/** La lista de la casa: existe siempre, no se borra y es adonde llegan las sugerencias automáticas. */
export const HOME_LIST_ID = "list-home";

/** Una lista de compras: la del súper, "Sanitarios" de la renovación del baño, "Herramientas de jardín"… */
export interface ShoppingList {
  id: string;
  name: string;
  /** Quién la ve con la casa en la nube (por defecto, Familia). Sus ítems heredan el nivel. */
  privacy?: Privacy;
  /** Proyecto al que pertenece (opcional). */
  projectId?: string;
  /** Presupuesto en centavos, en `currency`. */
  budgetCents?: number;
  currency: Currency;
  color: AppearanceColor;
  icon: AppearanceIcon;
  /** Archivada: no aparece entre las activas, pero su historial de gastos queda. */
  archivedAt?: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface ShoppingListInput {
  name: string;
  privacy?: Privacy;
  projectId?: string;
  /** Presupuesto en unidades de la moneda (no centavos). Vacío = sin presupuesto. */
  budget?: number | null;
  currency: Currency;
  color: AppearanceColor;
  icon: AppearanceIcon;
}

export const LIST_LIMITS = { nameMaxLength: 60, maxBudget: 1_000_000_000 } as const;

/** Monto en unidades (ej. 1500,50) → centavos enteros. `undefined` si está vacío. */
export function parseMoney(amount: number | null | undefined): number | undefined {
  if (amount === null || amount === undefined) return undefined;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > LIST_LIMITS.maxBudget) {
    throw new ValidationError("errors.validation.amountInvalid");
  }
  return Math.round(amount * 100);
}

export function parseListInput(input: ShoppingListInput) {
  const name = input.name?.trim() ?? "";
  const privacy = input.privacy ?? "family";
  if (!name) throw new ValidationError("errors.validation.nameRequired");
  if (name.length > LIST_LIMITS.nameMaxLength) throw new ValidationError("errors.validation.nameTooLong", { max: LIST_LIMITS.nameMaxLength });
  if (!isPrivacy(privacy)) throw new ValidationError("errors.validation.kindInvalid");
  if (!CURRENCIES.includes(input.currency)) throw new ValidationError("errors.validation.currencyInvalid");
  if (!isAppearanceColor(input.color) || !isAppearanceIcon(input.icon)) throw new ValidationError("errors.validation.appearanceInvalid");
  return { name, privacy, projectId: input.projectId || undefined, budgetCents: parseMoney(input.budget), currency: input.currency, color: input.color, icon: input.icon };
}

export type ShoppingStatus = "pending" | "bought";

export interface ShoppingListItem {
  id: string;
  /** Lista a la que pertenece (ver `HOME_LIST_ID`). */
  listId: string;
  name: string;
  quantity: number;
  unit: string;
  /** `pending` = falta comprar; `bought` = ya está en la bolsa. (Un booleano no se puede indexar en IndexedDB.) */
  status: ShoppingStatus;
  /** Producto del inventario al que repone (si no, es un ítem suelto: "velas de cumpleaños"). */
  inventoryItemId?: string;
  /** Cuánto se sumó al inventario al comprarlo (para poder desmarcarlo sin dejar stock de más). */
  restocked?: number;
  /** Precio estimado por unidad, en centavos de la moneda de la lista (para lo que no tiene historial de precios). */
  estimateCents?: number;
  /** Lo que se pagó en total, en centavos (y en qué moneda y dónde). */
  paidCents?: number;
  paidCurrency?: Currency;
  store?: string;
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
  /** Sin lista = la de la casa. */
  listId?: string;
  /** Precio estimado por unidad, en unidades de la moneda (opcional). */
  estimate?: number | null;
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
  return {
    name,
    quantity: input.quantity,
    unit: input.unit,
    inventoryItemId: input.inventoryItemId || undefined,
    listId: input.listId || HOME_LIST_ID,
    estimate: input.estimate ?? undefined,
  };
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

// --- Presupuesto ------------------------------------------------------------------

export interface ListBudget {
  currency: Currency;
  /** Lo que ya se pagó (de lo comprado con precio anotado). */
  spentCents: number;
  /** Lo que falta comprar, estimado (último precio o precio estimado). */
  pendingCents: number;
  /** Comprado sin precio anotado: se estima con el último precio conocido. */
  boughtEstimateCents: number;
  /** Ítems sin ningún precio (ni pagado, ni estimado, ni historial): el total puede quedarse corto. */
  unpriced: number;
  budgetCents?: number;
  /** Total previsto: gastado + estimado de lo comprado sin precio + lo que falta. */
  totalCents: number;
  /** Lo que queda del presupuesto (negativo = pasado). `undefined` sin presupuesto. */
  remainingCents?: number;
}

/** Precio por unidad que se usa para estimar un ítem, en la moneda de la lista (o `undefined`). */
function unitEstimate(item: Pick<ShoppingListItem, "estimateCents" | "inventoryItemId">, prices: Map<string, PriceSummary>, currency: Currency) {
  if (item.estimateCents !== undefined) return item.estimateCents;
  const summary = item.inventoryItemId ? prices.get(item.inventoryItemId) : undefined;
  // Solo se usa un precio de la misma moneda: no se mezclan pesos con dólares.
  return summary && summary.latest.currency === currency ? summary.latest.amountCents : undefined;
}

/** Gastado, pendiente y lo que queda del presupuesto de una lista. */
export function summarizeBudget(
  list: Pick<ShoppingList, "currency" | "budgetCents">,
  items: Pick<ShoppingListItem, "status" | "quantity" | "estimateCents" | "inventoryItemId" | "paidCents" | "paidCurrency">[],
  prices: Map<string, PriceSummary>,
): ListBudget {
  let spentCents = 0;
  let pendingCents = 0;
  let boughtEstimateCents = 0;
  let unpriced = 0;
  for (const item of items) {
    if (item.status === "bought" && item.paidCents !== undefined && (item.paidCurrency ?? list.currency) === list.currency) {
      spentCents += item.paidCents;
      continue;
    }
    const unit = unitEstimate(item, prices, list.currency);
    if (unit === undefined) {
      unpriced++;
      continue;
    }
    if (item.status === "bought") boughtEstimateCents += unit * item.quantity;
    else pendingCents += unit * item.quantity;
  }
  const totalCents = spentCents + boughtEstimateCents + pendingCents;
  return {
    currency: list.currency,
    spentCents,
    pendingCents,
    boughtEstimateCents,
    unpriced,
    budgetCents: list.budgetCents,
    totalCents,
    remainingCents: list.budgetCents === undefined ? undefined : list.budgetCents - totalCents,
  };
}
