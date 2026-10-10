import { isLocale, type Locale } from "@/i18n/config";
import { SKIN_IDS, type SkinId } from "@/skins/types";

export type ThemeMode = "light" | "dark" | "system";
export type FontSize = "sm" | "md" | "lg" | "xl";
export type Density = "comfortable" | "compact";
export type MotionPreference = "system" | "reduced" | "full";
export type LocalePreference = Locale | "system";
export type SidebarMode = "expanded" | "collapsed" | "hidden";
export const AUTO_LOCK_OPTIONS = [0, 1, 5, 15, 60] as const;
export type AutoLockMinutes = (typeof AUTO_LOCK_OPTIONS)[number];
/** Cómo se ve el inicio de Inventario. "places" solo existe ahí: dentro de un recinto ya estás en un lugar. */
export const INVENTORY_VIEWS = ["places", "plan", "list", "cards"] as const;
export type InventoryView = (typeof INVENTORY_VIEWS)[number];
export const SPACE_VIEWS = ["plan", "list", "cards"] as const;
export type SpaceView = (typeof SPACE_VIEWS)[number];
/**
 * Bloques que cada perfil puede ocultar. El id lleva la sección adelante ("inventory.restock") para
 * que una función nueva sume los suyos sin chocar. Cuando exista el registro de funciones, se mueve ahí.
 */
export const WIDGET_IDS = ["inventory.summary", "inventory.restock", "inventory.recent"] as const;
export type WidgetId = (typeof WIDGET_IDS)[number];

export interface Preferences {
  themeMode: ThemeMode;
  brandColor: string;
  borderRadius: number;
  fontSize: FontSize;
  /** Datos: "compact" achica filas, tarjetas y controles en toda la app. */
  density: Density;
  /** Encabezado de página: "compact" deja solo el título (sin bajada) y más chico. */
  headerDensity: Density;
  motion: MotionPreference;
  locale: LocalePreference;
  sidebar: SidebarMode;
  /** Bloqueo por inactividad para perfiles con PIN o biometría (0 = nunca). */
  autoLockMinutes: AutoLockMinutes;
  /** Vista por defecto del inicio de Inventario y de cada recinto (se recuerda por perfil). */
  inventoryView: InventoryView;
  spaceView: SpaceView;
  /** Inventario: mostrar los productos con cantidad 0. Por defecto no: lo que no tenés mete ruido. */
  showEmptyItems: boolean;
  /** Bloques ocultos por el perfil (ver `WIDGET_IDS`). */
  hiddenWidgets: WidgetId[];
  /** Estilo completo de la app (colores de fondo, sombras, tipografía, ilustraciones). Ver `src/skins`. */
  skin: SkinId;
}

export const DEFAULT_PREFERENCES: Preferences = {
  themeMode: "system",
  brandColor: "#1677ff",
  borderRadius: 8,
  fontSize: "md",
  density: "comfortable",
  headerDensity: "comfortable",
  motion: "system",
  locale: "system",
  sidebar: "expanded",
  autoLockMinutes: 15,
  inventoryView: "plan",
  spaceView: "plan",
  showEmptyItems: false,
  hiddenWidgets: [],
  skin: "casa",
};

/** Opciones válidas por clave: lo que se lee de localStorage se valida contra esto (puede estar editado a mano). */
const VALID: { [K in keyof Preferences]: (value: unknown) => boolean } = {
  themeMode: (v) => v === "light" || v === "dark" || v === "system",
  brandColor: (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v),
  borderRadius: (v) => typeof v === "number" && v >= 0 && v <= 20,
  fontSize: (v) => v === "sm" || v === "md" || v === "lg" || v === "xl",
  density: (v) => v === "comfortable" || v === "compact",
  headerDensity: (v) => v === "comfortable" || v === "compact",
  motion: (v) => v === "system" || v === "reduced" || v === "full",
  locale: (v) => v === "system" || isLocale(v),
  sidebar: (v) => v === "expanded" || v === "collapsed" || v === "hidden",
  autoLockMinutes: (v) => (AUTO_LOCK_OPTIONS as readonly unknown[]).includes(v),
  inventoryView: (v) => (INVENTORY_VIEWS as readonly unknown[]).includes(v),
  spaceView: (v) => (SPACE_VIEWS as readonly unknown[]).includes(v),
  showEmptyItems: (v) => typeof v === "boolean",
  hiddenWidgets: (v) => Array.isArray(v) && v.every((id) => (WIDGET_IDS as readonly unknown[]).includes(id)),
  skin: (v) => (SKIN_IDS as readonly unknown[]).includes(v),
};

export function isValidPreference<K extends keyof Preferences>(key: K, value: unknown): value is Preferences[K] {
  return VALID[key](value);
}

/** Se queda solo con las claves conocidas y válidas. */
export function sanitizePreferences(input: unknown): Partial<Preferences> {
  if (!input || typeof input !== "object") return {};
  const out: Partial<Record<keyof Preferences, unknown>> = {};
  for (const key of Object.keys(VALID) as (keyof Preferences)[]) {
    const value = (input as Record<string, unknown>)[key];
    if (VALID[key](value)) out[key] = value;
  }
  return out as Partial<Preferences>;
}

/** Colores de marca sugeridos (Ajustes y sistema de diseño). */
export const BRAND_PRESETS = ["#1677ff", "#722ed1", "#13c2c2", "#52c41a", "#fa8c16", "#eb2f96"] as const;
