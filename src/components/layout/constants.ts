import type { SidebarMode } from "@/store/usePreferencesStore";

/** Ancho del menú lateral por modo (px). */
export const SIDEBAR_WIDTH: Record<SidebarMode, number> = { expanded: 240, collapsed: 72, hidden: 0 };
