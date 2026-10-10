import { isLocale, type Locale } from "@/i18n/config";

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

export interface Preferences {
  themeMode: ThemeMode;
  brandColor: string;
  borderRadius: number;
  fontSize: FontSize;
  density: Density;
  motion: MotionPreference;
  locale: LocalePreference;
  sidebar: SidebarMode;
  /** Bloqueo por inactividad para perfiles con PIN o biometría (0 = nunca). */
  autoLockMinutes: AutoLockMinutes;
  /** Vista por defecto del inicio de Inventario y de cada recinto (se recuerda por perfil). */
  inventoryView: InventoryView;
  spaceView: SpaceView;
}

export const DEFAULT_PREFERENCES: Preferences = {
  themeMode: "system",
  brandColor: "#1677ff",
  borderRadius: 8,
  fontSize: "md",
  density: "comfortable",
  motion: "system",
  locale: "system",
  sidebar: "expanded",
  autoLockMinutes: 15,
  inventoryView: "plan",
  spaceView: "plan",
};

/** Opciones válidas por clave: lo que se lee de localStorage se valida contra esto (puede estar editado a mano). */
const VALID: { [K in keyof Preferences]: (value: unknown) => boolean } = {
  themeMode: (v) => v === "light" || v === "dark" || v === "system",
  brandColor: (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v),
  borderRadius: (v) => typeof v === "number" && v >= 0 && v <= 20,
  fontSize: (v) => v === "sm" || v === "md" || v === "lg" || v === "xl",
  density: (v) => v === "comfortable" || v === "compact",
  motion: (v) => v === "system" || v === "reduced" || v === "full",
  locale: (v) => v === "system" || isLocale(v),
  sidebar: (v) => v === "expanded" || v === "collapsed" || v === "hidden",
  autoLockMinutes: (v) => (AUTO_LOCK_OPTIONS as readonly unknown[]).includes(v),
  inventoryView: (v) => (INVENTORY_VIEWS as readonly unknown[]).includes(v),
  spaceView: (v) => (SPACE_VIEWS as readonly unknown[]).includes(v),
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
