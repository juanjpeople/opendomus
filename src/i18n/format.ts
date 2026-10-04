import { LOCALE_META, type Locale } from "./config";

export interface Formatters {
  number: (value: number) => string;
  date: (value: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  time: (value: Date | number) => string;
  /** "hace 5 minutos", "ayer", "en 2 días"… */
  relative: (timestamp: number, now?: number) => string;
  bytes: (value: number) => string;
  /** Montos guardados en centavos: `money(123450, "ARS")` → "$ 1.234,50". */
  money: (cents: number, currency: string) => string;
}

const cache = new Map<Locale, Formatters>();

const RELATIVE_STEPS: [limit: number, unit: Intl.RelativeTimeFormatUnit, seconds: number][] = [
  [60, "second", 1],
  [3600, "minute", 60],
  [86400, "hour", 3600],
  [604800, "day", 86400],
  [2629800, "week", 604800],
  [31557600, "month", 2629800],
  [Infinity, "year", 31557600],
];

/** Formateadores de Intl para un idioma (se crean una vez: construir un Intl.* es caro). */
export function getFormatters(locale: Locale): Formatters {
  const cached = cache.get(locale);
  if (cached) return cached;

  const intl = LOCALE_META[locale].intl;
  const number = new Intl.NumberFormat(intl);
  // En español, 24 h (como se usa en Argentina); en inglés, el formato del idioma.
  const time = new Intl.DateTimeFormat(intl, { hour: "2-digit", minute: "2-digit", hourCycle: locale === "es" ? "h23" : undefined });
  const relative = new Intl.RelativeTimeFormat(intl, { numeric: "auto" });
  const currencies = new Map<string, Intl.NumberFormat>();

  const formatters: Formatters = {
    number: (value) => number.format(value),
    date: (value, options) => new Intl.DateTimeFormat(intl, options).format(value),
    time: (value) => time.format(value),
    relative: (timestamp, now = Date.now()) => {
      const seconds = (timestamp - now) / 1000;
      if (Math.abs(seconds) < 45) return relative.format(0, "second");
      const [, unit, size] = RELATIVE_STEPS.find(([limit]) => Math.abs(seconds) < limit)!;
      return relative.format(Math.round(seconds / size), unit);
    },
    bytes: (value) => {
      const units = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;
      const index = Math.min(units.length - 1, Math.max(0, Math.floor(Math.log(Math.max(value, 1)) / Math.log(1024))));
      return new Intl.NumberFormat(intl, { style: "unit", unit: units[index], maximumFractionDigits: 1 }).format(
        value / 1024 ** index,
      );
    },
    money: (cents, currency) => {
      let formatter = currencies.get(currency);
      if (!formatter) {
        formatter = new Intl.NumberFormat(intl, { style: "currency", currency });
        currencies.set(currency, formatter);
      }
      return formatter.format(cents / 100);
    },
  };

  cache.set(locale, formatters);
  return formatters;
}
