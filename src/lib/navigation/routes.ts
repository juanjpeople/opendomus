import { Boxes, CalendarDays, ChefHat, HardHat, House, Palette, ScanLine, Settings, ShoppingCart, Sparkles, Users, type LucideIcon } from "lucide-react";
import type { MessageKey } from "@/i18n/translate";
import type { Permission } from "@/lib/auth/permissions";

export interface AppRoute {
  id: string;
  href: string;
  labelKey: MessageKey;
  icon: LucideIcon;
  /** Si se define, la ruta solo aparece (menú, búsqueda, recientes) para quien tenga el permiso. */
  permission?: Permission;
  section: "main" | "system";
  /** Ruta padre para las migas de pan. Por defecto, Inicio. */
  parent?: string;
  /** Ruta fuera del layout de la app (pública, sin sesión). */
  external?: boolean;
  /** No aparece en el menú (sí en la búsqueda y en las migas). */
  hidden?: boolean;
  /** Necesita `?id=`: sin él no sirve, así que no va a la búsqueda ni a "Recientes". */
  needsId?: boolean;
}

/**
 * Registro único de rutas: de acá salen el menú, las migas de pan, la búsqueda (Ctrl+K),
 * los recientes y el título de la pestaña. Para sumar una página: agregarla acá
 * (y proteger la página con `RequirePermission` si lleva permiso).
 */
export const APP_ROUTES: AppRoute[] = [
  { id: "home", href: "/", labelKey: "nav.routes.home", icon: House, section: "main" },
  { id: "inventory", href: "/inventario", labelKey: "nav.routes.inventory", icon: Boxes, permission: "inventory.view", section: "main" },
  { id: "scan", href: "/inventario/escanear", labelKey: "nav.routes.scan", icon: ScanLine, permission: "inventory.view", section: "main", parent: "inventory", hidden: true },
  { id: "calendar", href: "/calendario", labelKey: "nav.routes.calendar", icon: CalendarDays, permission: "calendar.view", section: "main" },
  { id: "compras", href: "/compras", labelKey: "nav.routes.compras", icon: ShoppingCart, permission: "shopping.view", section: "main" },
  { id: "recipes", href: "/recetas", labelKey: "nav.routes.recipes", icon: ChefHat, permission: "recipes.view", section: "main" },
  { id: "projects", href: "/proyectos", labelKey: "nav.routes.projects", icon: HardHat, permission: "projects.view", section: "main" },
  { id: "project", href: "/proyectos/ver", labelKey: "nav.routes.project", icon: HardHat, permission: "projects.view", section: "main", parent: "projects", hidden: true, needsId: true },
  // Detalle y editor con `?id=`: páginas fijas (sin rutas dinámicas), así la app se puede publicar como sitio estático.
  { id: "recipe", href: "/recetas/ver", labelKey: "nav.routes.recipe", icon: ChefHat, permission: "recipes.view", section: "main", parent: "recipes", hidden: true, needsId: true },
  { id: "recipeEdit", href: "/recetas/editar", labelKey: "nav.routes.recipeEdit", icon: ChefHat, permission: "recipes.manage", section: "main", parent: "recipes", hidden: true, needsId: true },
  { id: "family", href: "/familia", labelKey: "nav.routes.family", icon: Users, section: "system" },
  { id: "settings", href: "/ajustes", labelKey: "nav.routes.settings", icon: Settings, section: "system" },
  { id: "design", href: "/design", labelKey: "nav.routes.design", icon: Palette, permission: "settings.design", section: "system" },
  { id: "values", href: "/bienvenida", labelKey: "nav.routes.values", icon: Sparkles, section: "system", external: true },
];

const BY_ID = new Map(APP_ROUTES.map((route) => [route.id, route]));

export function findRoute(pathname: string): AppRoute | undefined {
  // La coincidencia más específica gana ("/" solo coincide exacto).
  return APP_ROUTES.filter((route) =>
    route.href === "/" ? pathname === "/" : pathname === route.href || pathname.startsWith(`${route.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0];
}

/** Cadena de rutas desde Inicio hasta la actual (para las migas de pan). */
export function getRouteTrail(route: AppRoute | undefined): AppRoute[] {
  if (!route) return [];
  const trail: AppRoute[] = [route];
  let current = route;
  while (current.id !== "home") {
    const parent = BY_ID.get(current.parent ?? "home");
    if (!parent || trail.includes(parent)) break;
    trail.unshift(parent);
    current = parent;
  }
  return trail;
}
