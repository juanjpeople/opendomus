import type { Locale } from "@/i18n";

/**
 * Búsqueda de precios online, respetando "Nada sale sin permiso": no se consulta nada
 * automáticamente; cada proveedor es un enlace que la persona abre cuando quiere.
 * El seguimiento automático de precios/ofertas necesita el servidor (conector opcional).
 */
export interface PriceSearchProvider {
  id: string;
  name: string;
  url: (query: string) => string;
}

const PROVIDERS: Record<Locale, PriceSearchProvider[]> = {
  es: [
    { id: "mercadolibre", name: "Mercado Libre", url: (q) => `https://listado.mercadolibre.com.ar/${encodeURIComponent(q).replace(/%20/g, "-")}` },
    { id: "google-shopping", name: "Google Shopping", url: (q) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}` },
    { id: "ofertas", name: "Ofertas (Google)", url: (q) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${q} oferta`)}` },
  ],
  en: [
    { id: "google-shopping", name: "Google Shopping", url: (q) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}` },
    { id: "amazon", name: "Amazon", url: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}` },
    { id: "deals", name: "Deals (Google)", url: (q) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${q} deal`)}` },
  ],
};

export function getPriceSearchProviders(locale: Locale): PriceSearchProvider[] {
  return PROVIDERS[locale];
}
