import { Apple, Battery, Drill, Hammer, SprayCan, type LucideIcon } from "lucide-react";
import type { AppearanceColor } from "@/lib/appearance";
import type { CatalogCategory } from "./catalog";

export const CATEGORY_APPEARANCE: Record<CatalogCategory, { Icon: LucideIcon; color: AppearanceColor }> = {
  food: { Icon: Apple, color: "green" },
  cleaning: { Icon: SprayCan, color: "cyan" },
  hardware: { Icon: Hammer, color: "gold" },
  electrical: { Icon: Battery, color: "blue" },
  tools: { Icon: Drill, color: "volcano" },
};
