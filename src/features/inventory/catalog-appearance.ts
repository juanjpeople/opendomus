import { Apple, Battery, Drill, Hammer, SprayCan, Droplets, Palette, Pencil, type LucideIcon } from "lucide-react";
import type { AppearanceColor } from "@/lib/appearance";
import type { CatalogCategory } from "./catalog";

export const CATEGORY_APPEARANCE: Record<CatalogCategory, { Icon: LucideIcon; color: AppearanceColor }> = {
  food: { Icon: Apple, color: "green" },
  cleaning: { Icon: SprayCan, color: "cyan" },
  hygiene: { Icon: Droplets, color: "magenta" },
  stationery: { Icon: Pencil, color: "blue" },
  ceramics: { Icon: Palette, color: "purple" },
  hardware: { Icon: Hammer, color: "gold" },
  electrical: { Icon: Battery, color: "blue" },
  tools: { Icon: Drill, color: "volcano" },
};
