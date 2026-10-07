/** Public retail snapshots, never prices paid by a household. See docs/CATALOGO.md. */
export interface ReferencePrice {
  catalogId: string;
  product: string;
  presentation: string;
  amountCents: number;
  currency: "ARS";
  store: string;
  url: string;
  consultedAt: string;
  sourceAge: "recent" | "older";
}

const dia = (catalogId: string, product: string, presentation: string, pesos: number, slug: string, sourceAge: ReferencePrice["sourceAge"] = "recent"): ReferencePrice => ({
  catalogId, product, presentation, amountCents: Math.round(pesos * 100), currency: "ARS",
  store: "DIA online · Argentina", url: `https://diaonline.supermercadosdia.com.ar/${slug}/p`,
  consultedAt: "2026-10-07", sourceAge,
});

/** List prices where a promotion is shown; excludes shipping, memberships and bank discounts. */
export const REFERENCE_PRICES: readonly ReferencePrice[] = [
  dia("rice", "Arroz largo fino DIA", "1 kg", 1490, "arroz-largo-fino-00000-dia-1-kg-55745"),
  dia("pasta", "Fideos codito DIA", "500 g", 1390, "fideos-codito-dia-500-gr-286226"),
  dia("flour", "Harina de trigo 000 DIA", "1 kg", 1050, "harina-de-trigo-000-dia-1-kg-24272"),
  dia("lentils", "Lentejas DIA", "400 g", 2101, "lentejas-dia-400-gr-292388"),
  dia("yerba", "Yerba mate DIA con palo", "1 kg", 3650, "yerba-mate-dia-elaborado-con-palo-1-kg-24161", "older"),
  dia("potatoes", "Papa negra", "1 kg", 2990, "papa-negra-x-kg-90094"),
  dia("eggs", "Huevos blancos grandes", "6 ud.", 2390, "huevo-blanco-grande-6-ud-31924"),
  dia("milk", "Leche entera larga vida DIA", "1 l", 2390, "leche-entera-dia-larga-vida-1-lt-608"),
  dia("oil", "Aceite de girasol DIA", "900 ml", 3645, "aceite-de-girasol-dia-900-ml-226068"),
  dia("tomato", "Puré de tomate Arcor", "520 g", 1220, "pure-de-tomate-arcor-520-gr-56121", "older"),
  dia("toilet-paper", "Papel higiénico DIA, hoja simple", "6 × 30 m", 3350, "papel-higienico-simple-hoja-30-mts-6-ud-246978", "older"),
  dia("dishcloth", "Rejilla DIA", "1 ud.", 1715, "trapo-rejilla-dia-multiuso-ecoamigable-1-ud-269121", "older"),
  dia("degreaser", "Antigrasa CIF Expert", "450 ml", 2490, "limpiador-cif-expert-antigrasa-doypack-450-ml-64961"),
  dia("dish-soap", "Detergente CIF Bioactive", "500 ml", 4390, "detergente-cif-bioactive-limon-botella-500-ml-294028"),
  dia("bleach", "Lavandina DIA triple acción", "1 l", 1490, "lavandina-dia-triple-accion-1-lt-275291", "older"),
  { catalogId: "clay", product: "Arcilla blanca Chilavert", presentation: "10 kg", amountCents: 1600000, currency: "ARS", store: "Nuevas Criaturas · Argentina", url: "https://nuevascriaturas.com.ar/producto/arcilla-blanca-2/", consultedAt: "2026-10-07", sourceAge: "older" },
];

export function referenceFor(catalogId: string) {
  return REFERENCE_PRICES.find((entry) => entry.catalogId === catalogId);
}

/** A reference is not a live quote, even during this seven-day editorial window. */
export function referenceNeedsReview(reference: ReferencePrice, now = Date.now()) {
  const age = now - Date.parse(`${reference.consultedAt}T00:00:00Z`);
  return reference.sourceAge === "older" || age < 0 || age >= 7 * 86400000;
}
