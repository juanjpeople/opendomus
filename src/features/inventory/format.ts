import type { Translator } from "@/i18n/translate";
import { isUnit } from "./domain";

/** Las unidades propias conservan su texto; las conocidas siguen el plural del idioma. */
export function formatUnit(t: Translator, quantity: number, unit: string | undefined): string {
  return unit && isUnit(unit) ? t(`inventory.units.${unit}`, { count: quantity }) : (unit ?? "");
}

/** El formateador del idioma también se aplica a decimales y separadores de miles. */
export function formatQuantity(t: Translator, quantity: number, unit: string | undefined, number: (value: number) => string): string {
  return [number(quantity), formatUnit(t, quantity, unit)].filter(Boolean).join(" ");
}
