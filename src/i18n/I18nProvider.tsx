"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import { usePreferences } from "@/hooks/usePreferences";
import { DEFAULT_LOCALE, detectBrowserLocale, type Locale } from "./config";
import { getFormatters, type Formatters } from "./format";
import { getTranslator, type Translator } from "./translate";

interface I18nValue {
  locale: Locale;
  t: Translator;
  format: Formatters;
}

const I18nContext = createContext<I18nValue | null>(null);

/** Idioma activo: el elegido por el perfil o, en "sistema", el del navegador. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const { locale: preference } = usePreferences();
  // Hasta hidratar se usa el idioma base: es el que renderizó el servidor.
  const locale: Locale = preference !== "system" ? preference : hydrated ? detectBrowserLocale() : DEFAULT_LOCALE;

  const value = useMemo(() => ({ locale, t: getTranslator(locale), format: getFormatters(locale) }), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n debe usarse dentro de <I18nProvider>.");
  return value;
}

/** Atajo para lo más común: `const t = useT(); t("inventory.form.name")`. */
export function useT(): Translator {
  return useI18n().t;
}
