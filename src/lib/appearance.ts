/**
 * Apariencia elegible por el usuario (color e ícono de recintos, contenedores…).
 * Se guarda una CLAVE, nunca un color o un SVG: así se valida, se adapta al modo oscuro
 * (las paletas de antd se regeneran por tema) y el registro puede crecer sin migraciones.
 */
import {
  Apple,
  Archive,
  Axe,
  Baby,
  Bath,
  Battery,
  Bed,
  Beef,
  Bike,
  BookOpen,
  Box,
  Cake,
  Camera,
  Car,
  Carrot,
  Cat,
  Coffee,
  CookingPot,
  DoorClosed,
  Dog,
  Drill,
  Droplets,
  Fish,
  Flame,
  Flower2,
  Gamepad2,
  Gift,
  Grid2x2,
  Hammer,
  Inbox,
  Heart,
  Laptop,
  Layers,
  LibraryBig,
  Lightbulb,
  MapPin,
  Milk,
  Music,
  Package,
  Paintbrush,
  Pill,
  Plug,
  Refrigerator,
  Rows3,
  Scissors,
  Shirt,
  Shovel,
  Snowflake,
  Sofa,
  SprayCan,
  Sprout,
  Star,
  Tent,
  ToolCase,
  Trees,
  Tv,
  Umbrella,
  Utensils,
  Warehouse,
  Wine,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { GlobalToken } from "antd";

/** Paleta de antd: cada clave tiene 10 tonos que se adaptan a claro/oscuro. */
export const APPEARANCE_COLORS = ["blue", "geekblue", "purple", "magenta", "red", "volcano", "orange", "gold", "lime", "green", "cyan"] as const;
export type AppearanceColor = (typeof APPEARANCE_COLORS)[number];

export const APPEARANCE_ICONS = {
  // Cocina y comida
  refrigerator: Refrigerator,
  snowflake: Snowflake,
  cookingPot: CookingPot,
  utensils: Utensils,
  coffee: Coffee,
  wine: Wine,
  milk: Milk,
  apple: Apple,
  carrot: Carrot,
  beef: Beef,
  fish: Fish,
  cake: Cake,
  // Guardado
  archive: Archive,
  layers: Layers,
  libraryBig: LibraryBig,
  box: Box,
  package: Package,
  toolCase: ToolCase,
  shirt: Shirt,
  rows: Rows3,
  door: DoorClosed,
  grid: Grid2x2,
  inbox: Inbox,
  gift: Gift,
  // Taller y casa
  hammer: Hammer,
  wrench: Wrench,
  drill: Drill,
  axe: Axe,
  shovel: Shovel,
  paintbrush: Paintbrush,
  scissors: Scissors,
  battery: Battery,
  plug: Plug,
  lightbulb: Lightbulb,
  zap: Zap,
  sprayCan: SprayCan,
  droplets: Droplets,
  flame: Flame,
  // Ambientes
  sofa: Sofa,
  bed: Bed,
  bath: Bath,
  warehouse: Warehouse,
  car: Car,
  bike: Bike,
  trees: Trees,
  sprout: Sprout,
  flower: Flower2,
  tent: Tent,
  umbrella: Umbrella,
  // Personas, ocio y otros
  baby: Baby,
  dog: Dog,
  cat: Cat,
  pill: Pill,
  bookOpen: BookOpen,
  gamepad: Gamepad2,
  music: Music,
  tv: Tv,
  laptop: Laptop,
  camera: Camera,
  heart: Heart,
  star: Star,
  mapPin: MapPin,
} satisfies Record<string, LucideIcon>;

export type AppearanceIcon = keyof typeof APPEARANCE_ICONS;

export function isAppearanceColor(value: unknown): value is AppearanceColor {
  return typeof value === "string" && (APPEARANCE_COLORS as readonly string[]).includes(value);
}

export function isAppearanceIcon(value: unknown): value is AppearanceIcon {
  return typeof value === "string" && value in APPEARANCE_ICONS;
}

/** Tonos de un color para el tema actual: fondo suave, borde, color fuerte y texto. */
export function tint(token: GlobalToken, color: AppearanceColor) {
  const shade = (step: number) => (token as unknown as Record<string, string>)[`${color}${step}`];
  return { bg: shade(1), bgHover: shade(2), border: shade(3), solid: shade(6), text: shade(7) };
}
