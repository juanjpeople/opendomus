/**
 * Idiomas soportados. Para sumar uno: agregarlo acá, crear `messages/<código>.ts`
 * tipado como `Messages` (TypeScript marca las claves faltantes) y registrarlo en `messages/index.ts`.
 */
export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es";

export const LOCALE_META: Record<Locale, { label: string; intl: string }> = {
  es: { label: "Español", intl: "es-AR" },
  en: { label: "English", intl: "en-US" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Idioma del navegador, si lo soportamos. Solo en el cliente. */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
