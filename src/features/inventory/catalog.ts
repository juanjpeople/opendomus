import type { Locale } from "@/i18n/config";
import { normalizeSearch } from "@/lib/search";
import type { NewInventoryItem, Unit } from "./domain";

export const CATALOG_CATEGORIES = ["food", "cleaning", "hygiene", "stationery", "hardware", "electrical", "tools", "ceramics"] as const;
export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

/** Plantillas, nunca existencias: elegir una no presupone que haya stock en la casa. */
export interface CatalogProduct {
  id: string;
  category: CatalogCategory;
  name: Record<Locale, string>;
  aliases: string[];
  unit: Unit;
  durable: boolean;
}

function product(id: string, category: CatalogCategory, es: string, en: string, unit: Unit = "unidades", aliases: string[] = [], durable = false): CatalogProduct {
  return { id, category, name: { es, en }, aliases, unit, durable };
}

/** Identificadores estables y sin marcas; las variantes comerciales podrán agregarse después. */
export const BASIC_CATALOG: readonly CatalogProduct[] = [
  product("notebook", "stationery", "Cuaderno", "Notebook"),
  product("pencil", "stationery", "Lápiz negro", "Pencil"),
  product("pen", "stationery", "Lapicera", "Pen", "unidades", ["bolígrafo"]),
  product("eraser", "stationery", "Goma de borrar", "Eraser"),
  product("sharpener", "stationery", "Sacapuntas", "Pencil sharpener", "unidades", [], true),
  product("ruler", "stationery", "Regla", "Ruler", "unidades", [], true),
  product("school-scissors", "stationery", "Tijera escolar", "School scissors", "unidades", [], true),
  product("glue-stick", "stationery", "Adhesivo en barra", "Glue stick"),
  product("colored-pencils", "stationery", "Lápices de colores", "Colored pencils", "cajas"),
  product("markers", "stationery", "Marcadores", "Markers", "cajas", ["fibras"]),
  product("folder", "stationery", "Carpeta escolar", "School folder", "unidades", [], true),
  product("paper-a4", "stationery", "Hojas A4", "A4 paper", "paquetes"),
  product("backpack", "stationery", "Mochila", "Backpack", "unidades", [], true),
  product("sugar", "food", "Azúcar", "Sugar", "paquetes"),
  product("rice", "food", "Arroz", "Rice", "paquetes"),
  product("pasta", "food", "Fideos", "Pasta", "paquetes", ["pastas"]),
  product("flour", "food", "Harina", "Flour", "paquetes"),
  product("yerba", "food", "Yerba mate", "Yerba mate", "paquetes"),
  product("coffee-bags", "food", "Café en saquitos", "Coffee bags", "cajas"),
  product("ground-coffee", "food", "Café molido", "Ground coffee", "paquetes"),
  product("instant-coffee", "food", "Café instantáneo", "Instant coffee"),
  product("tea", "food", "Té en saquitos", "Tea bags", "cajas"),
  product("mate-cocido", "food", "Mate cocido", "Mate tea bags", "cajas"),
  product("salt", "food", "Sal fina", "Table salt", "paquetes"),
  product("coarse-salt", "food", "Sal gruesa", "Coarse salt", "paquetes"),
  product("oil", "food", "Aceite", "Cooking oil", "litros"),
  product("vinegar", "food", "Vinagre", "Vinegar", "litros"),
  product("milk", "food", "Leche", "Milk", "litros"),
  product("eggs", "food", "Huevos", "Eggs"),
  product("tomato", "food", "Puré de tomate", "Tomato purée"),
  product("lentils", "food", "Lentejas", "Lentils", "paquetes"),
  product("oats", "food", "Avena", "Oats", "paquetes"),
  product("cornmeal", "food", "Polenta", "Cornmeal", "paquetes"),
  product("breadcrumbs", "food", "Pan rallado", "Breadcrumbs", "paquetes"),
  product("tuna", "food", "Atún en lata", "Canned tuna"),
  product("crackers", "food", "Galletitas", "Biscuits", "paquetes", ["galletas"]),
  product("dulce-de-leche", "food", "Dulce de leche", "Dulce de leche"),
  product("potatoes", "food", "Papas", "Potatoes", "gr"),
  product("onions", "food", "Cebollas", "Onions", "gr"),
  product("carrots", "food", "Zanahorias", "Carrots", "gr"),
  product("fresh-tomatoes", "food", "Tomates", "Tomatoes", "gr"),
  product("apples", "food", "Manzanas", "Apples", "gr"),
  product("bananas", "food", "Bananas", "Bananas", "gr"),
  product("chicken", "food", "Pollo", "Chicken", "gr"),
  product("minced-beef", "food", "Carne picada", "Minced beef", "gr"),
  product("cheese", "food", "Queso cremoso", "Soft cheese", "gr"),
  product("butter", "food", "Manteca", "Butter", "gr"),
  product("yogurt", "food", "Yogur", "Yogurt"),
  product("bread", "food", "Pan", "Bread", "gr"),
  product("chickpeas", "food", "Garbanzos", "Chickpeas", "paquetes"),
  product("beans", "food", "Porotos", "Beans", "paquetes"),
  product("toothpaste", "hygiene", "Pasta dental", "Toothpaste"),
  product("toothbrush", "hygiene", "Cepillo de dientes", "Toothbrush", "unidades", [], true),
  product("shampoo", "hygiene", "Champú", "Shampoo", "unidades", ["shampoo"]),
  product("period-pads", "hygiene", "Toallitas menstruales", "Period pads", "paquetes"),
  product("diapers", "hygiene", "Pañales", "Diapers", "paquetes"),
  product("bleach", "cleaning", "Lavandina", "Bleach", "litros", ["lejía", "cloro"]),
  product("dish-soap", "cleaning", "Detergente", "Dishwashing liquid", "litros", ["lavavajillas"]),
  product("laundry-liquid", "cleaning", "Jabón líquido para ropa", "Liquid laundry detergent", "litros", ["jabon liquido ropa"]),
  product("laundry-powder", "cleaning", "Jabón en polvo", "Laundry powder", "paquetes"),
  product("softener", "cleaning", "Suavizante", "Fabric softener", "litros"),
  product("floor-cleaner", "cleaning", "Perfume para piso", "Floor cleaner", "litros", ["perfume piso", "limpiapisos", "limpiador de pisos"]),
  product("degreaser", "cleaning", "Desengrasante", "Degreaser"),
  product("glass-cleaner", "cleaning", "Limpiavidrios", "Glass cleaner"),
  product("sponges", "cleaning", "Esponjas", "Sponges"),
  product("floor-cloth", "cleaning", "Trapo de piso", "Floor cloth"),
  product("dishcloth", "cleaning", "Rejilla", "Dishcloth"),
  product("trash-bags", "cleaning", "Bolsas de residuos", "Trash bags", "paquetes"),
  product("toilet-paper", "cleaning", "Papel higiénico", "Toilet paper", "paquetes"),
  product("paper-towels", "cleaning", "Rollo de cocina", "Paper towels"),
  product("hand-soap", "cleaning", "Jabón de manos", "Hand soap"),
  product("screws", "hardware", "Tornillos varios", "Assorted screws", "cajas"),
  product("nuts", "hardware", "Tuercas", "Nuts", "cajas"),
  product("washers", "hardware", "Arandelas", "Washers", "cajas"),
  product("nails", "hardware", "Clavos", "Nails", "cajas"),
  product("wall-plugs", "hardware", "Tarugos", "Wall plugs", "paquetes", ["tacos"]),
  product("sandpaper", "hardware", "Lijas", "Sandpaper", "unidades", ["papel de lija"]),
  product("wood-bits", "hardware", "Mechas para madera", "Wood drill bits", "unidades", ["brocas madera"]),
  product("metal-bits", "hardware", "Mechas para metal", "Metal drill bits", "unidades", ["brocas metal"]),
  product("masonry-bits", "hardware", "Mechas para pared", "Masonry drill bits", "unidades", ["brocas mamposteria", "widia"]),
  product("cutting-discs", "hardware", "Discos de corte", "Cutting discs"),
  product("masking-tape", "hardware", "Cinta de papel", "Masking tape"),
  product("ptfe-tape", "hardware", "Cinta de teflón", "PTFE tape"),
  product("silicone", "hardware", "Sellador de silicona", "Silicone sealant"),
  product("wood-glue", "hardware", "Cola vinílica", "Wood glue"),
  product("cable-ties", "hardware", "Precintos", "Cable ties", "paquetes", ["bridas"]),
  product("aa-battery", "electrical", "Pilas AA", "AA batteries", "unidades", ["doble a"]),
  product("aaa-battery", "electrical", "Pilas AAA", "AAA batteries", "unidades", ["triple a"]),
  product("9v-battery", "electrical", "Pilas de 9 V", "9 V batteries"),
  product("coin-battery", "electrical", "Pilas botón CR2032", "CR2032 coin batteries"),
  product("bulbs", "electrical", "Lamparitas LED", "LED bulbs", "unidades", ["bombillas", "lamparas"]),
  product("electrical-tape", "electrical", "Cinta aisladora", "Electrical tape", "unidades", ["cinta aislante"]),
  product("cable", "electrical", "Cable eléctrico", "Electrical cable", "metros"),
  product("plugs", "electrical", "Fichas eléctricas", "Electrical plugs", "unidades", ["enchufes"]),
  product("usb-cable", "electrical", "Cable USB", "USB cable", "unidades", [], true),
  product("charger", "electrical", "Cargador de celular", "Phone charger", "unidades", [], true),
  product("drill", "tools", "Taladro", "Drill", "unidades", [], true),
  product("angle-grinder", "tools", "Amoladora", "Angle grinder", "unidades", [], true),
  product("sander", "tools", "Lijadora", "Sander", "unidades", [], true),
  product("jigsaw", "tools", "Sierra caladora", "Jigsaw", "unidades", [], true),
  product("driver", "tools", "Atornillador eléctrico", "Power screwdriver", "unidades", [], true),
  product("hammer", "tools", "Martillo", "Hammer", "unidades", [], true),
  product("pliers", "tools", "Pinza universal", "Combination pliers", "unidades", ["alicate"], true),
  product("wrench", "tools", "Llave francesa", "Adjustable wrench", "unidades", [], true),
  product("tape-measure", "tools", "Cinta métrica", "Tape measure", "unidades", ["metro"], true),
  product("screwdriver", "tools", "Destornillador", "Screwdriver", "unidades", [], true),
  product("clay", "ceramics", "Arcilla para cerámica", "Pottery clay", "gr", ["pasta ceramica"]),
  product("slip", "ceramics", "Barbotina", "Casting slip", "gr"),
  product("glaze", "ceramics", "Esmalte cerámico", "Ceramic glaze", "gr"),
  product("pottery-tools", "ceramics", "Estecas", "Modelling tools", "unidades", [], true),
  product("brush", "ceramics", "Pincel", "Brush", "unidades", [], true),
  product("clay-wire", "ceramics", "Hilo cortador de arcilla", "Clay cutting wire", "unidades", [], true),
];

export function searchCatalog(query: string, category?: CatalogCategory): CatalogProduct[] {
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  return BASIC_CATALOG.filter((entry) => {
    if (category && entry.category !== category) return false;
    const haystack = normalizeSearch([...Object.values(entry.name), ...entry.aliases].join(" "));
    return terms.every((term) => haystack.includes(term));
  });
}

export function catalogDefaults(entry: CatalogProduct, locale: Locale): NewInventoryItem {
  return { name: entry.name[locale], quantity: 1, unit: entry.unit, minThreshold: entry.durable ? 0 : 1, autoSuggest: !entry.durable, reusable: entry.durable };
}

const BY_NAME = new Map(BASIC_CATALOG.flatMap((entry) => [...Object.values(entry.name), ...entry.aliases].map((name) => [normalizeSearch(name), entry] as const)));

/** Solo coincidencias conocidas: no adivina el rubro de un nombre personalizado. */
export function findCatalogProduct(name: string): CatalogProduct | undefined {
  return BY_NAME.get(normalizeSearch(name));
}
