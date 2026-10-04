/**
 * Precios de productos: cada compra o precio visto queda registrado (historial),
 * así se puede ver el último, el más barato y dónde.
 */
import { ValidationError } from "@/lib/errors";

export const CURRENCIES = ["ARS", "USD", "EUR", "UYU", "CLP", "MXN", "BRL"] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface PriceRecord {
  id: string;
  itemId: string;
  /** En centavos (enteros): sin errores de redondeo de punto flotante. */
  amountCents: number;
  currency: Currency;
  /** Dónde (supermercado, ferretería, tienda online…). */
  store: string;
  /** Cuándo se vio o pagó ese precio. */
  at: number;
  createdBy: string;
}

export type NewPrice = { itemId: string; amount: number; currency: Currency; store: string; at: number };

export const PRICE_LIMITS = { maxAmount: 1_000_000_000, storeMaxLength: 60 } as const;

export function parseNewPrice(input: NewPrice): Omit<PriceRecord, "id" | "createdBy"> {
  if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount <= 0 || input.amount > PRICE_LIMITS.maxAmount) {
    throw new ValidationError("errors.validation.amountInvalid");
  }
  if (!CURRENCIES.includes(input.currency)) throw new ValidationError("errors.validation.currencyInvalid");
  const store = input.store?.trim() ?? "";
  if (store.length > PRICE_LIMITS.storeMaxLength) {
    throw new ValidationError("errors.validation.nameTooLong", { max: PRICE_LIMITS.storeMaxLength });
  }
  if (!Number.isFinite(input.at) || input.at > Date.now() + 86_400_000) throw new ValidationError("errors.validation.dateInvalid");
  return { itemId: input.itemId, amountCents: Math.round(input.amount * 100), currency: input.currency, store, at: input.at };
}

export interface PriceSummary {
  latest: PriceRecord;
  cheapest: PriceRecord;
  /** Variación del último respecto del anterior (ej. 0.12 = +12 %). `null` si hay un solo precio. */
  change: number | null;
  count: number;
}

/** Resumen de un historial (de cualquier orden). Solo compara precios de la moneda del último. */
export function summarizePrices(records: PriceRecord[]): PriceSummary | null {
  if (records.length === 0) return null;
  const byDate = [...records].sort((a, b) => b.at - a.at);
  const latest = byDate[0];
  const sameCurrency = byDate.filter((record) => record.currency === latest.currency);
  const cheapest = sameCurrency.reduce((min, record) => (record.amountCents < min.amountCents ? record : min));
  const previous = sameCurrency[1];
  return {
    latest,
    cheapest,
    change: previous ? (latest.amountCents - previous.amountCents) / previous.amountCents : null,
    count: records.length,
  };
}

export function defaultCurrencyFor(locale: string): Currency {
  return locale === "en" ? "USD" : "ARS";
}
