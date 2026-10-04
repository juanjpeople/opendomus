"use client";

import { ChefHat, ClipboardList, HardHat, Languages, ListPlus, LogOut, Monitor, Moon, Package, PanelLeft, PanelLeftClose, PanelLeftDashed, ScanLine, Sun, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useAllInventoryItems } from "@/features/inventory/hooks";
import { useProjects } from "@/features/projects/hooks";
import { useRecipeNames } from "@/features/recipes/hooks";
import { listName, useListSummaries } from "@/features/shopping/hooks";
import { containerAppearance } from "@/features/storage/domain";
import { useContainers } from "@/features/storage/hooks";
import { useSetPreference } from "@/hooks/usePreferences";
import { LOCALE_META, LOCALES, useI18n } from "@/i18n";
import { can } from "@/lib/auth/permissions";
import { useCurrentUser, useSessionStore } from "@/lib/auth/session";
import { containerHref, findRoute, projectHref, recipeHref } from "@/lib/navigation/routes";
import { useNavigationStore } from "@/store/useNavigationStore";
import { useVisibleRoutes } from "./Navigation";

export interface Command {
  id: string;
  group: "recent" | "pages" | "containers" | "items" | "recipes" | "lists" | "actions";
  label: string;
  icon: LucideIcon;
  /** Texto extra para la búsqueda (no se muestra). */
  keywords?: string;
  run: () => void;
}

/**
 * Comandos disponibles para la búsqueda (Ctrl+K). Para sumar acciones de un módulo,
 * agregarlas acá: la paleta las filtra, ordena y ejecuta sin cambios.
 */
export function useCommands(): Command[] {
  const router = useRouter();
  const { t, locale } = useI18n();
  const user = useCurrentUser();
  const routes = useVisibleRoutes();
  const setPreference = useSetPreference();
  const signOut = useSessionStore((s) => s.signOut);
  const recent = useNavigationStore((s) => (user ? s.recent[user.id] : undefined));
  const containers = useContainers();
  const items = useAllInventoryItems();
  const recipes = useRecipeNames();
  const lists = useListSummaries();
  const projects = useProjects();

  return useMemo(() => {
    const visible = new Set(routes.map((route) => route.id));

    const containerById = new Map((containers ?? []).map((container) => [container.id, container]));

    const recipeById = new Map((recipes ?? []).map((recipe) => [recipe.id, recipe]));
    const projectById = new Map((projects ?? []).map((summary) => [summary.project.id, summary.project]));

    // Un reciente puede ser una página o algo puntual con `?id=` (un contenedor, una receta, un proyecto).
    const recentCommands: Command[] = (recent ?? []).flatMap((visit): Command[] => {
      const [path, query = ""] = visit.href.split("?");
      const route = findRoute(path);
      if (!route || !visible.has(route.id)) return [];
      if (route.needsId) {
        const id = new URLSearchParams(query).get("id") ?? "";
        const go = () => router.push(visit.href);
        const container = route.id === "container" ? containerById.get(id) : undefined;
        if (container) return [{ id: `recent:${visit.href}`, group: "recent", label: container.name, icon: containerAppearance(container).Icon, run: go }];
        const recipe = route.id === "recipe" ? recipeById.get(id) : undefined;
        if (recipe) return [{ id: `recent:${visit.href}`, group: "recent", label: recipe.name, icon: ChefHat, run: go }];
        const project = route.id === "project" ? projectById.get(id) : undefined;
        if (project) return [{ id: `recent:${visit.href}`, group: "recent", label: project.name, icon: HardHat, run: go }];
        return [];
      }
      return [{ id: `recent:${visit.href}`, group: "recent", label: t(route.labelKey), icon: route.icon, run: () => router.push(route.href) }];
    }).slice(0, 4);

    const containerCommands: Command[] = visible.has("inventory")
      ? (containers ?? []).map((container) => ({
          id: `container:${container.id}`,
          group: "containers",
          label: `${container.path} · ${container.spaceName}`,
          icon: containerAppearance(container).Icon,
          keywords: container.code,
          run: () => router.push(containerHref(container.id)),
        }))
      : [];

    // Productos: "leche" lleva al contenedor donde está guardada.
    const itemCommands: Command[] = visible.has("inventory")
      ? (items ?? []).flatMap((item): Command[] => {
          const container = containerById.get(item.containerId);
          if (!container) return [];
          return [
            {
              id: `item:${item.id}`,
              group: "items",
              label: `${item.name} · ${container.spaceName} › ${container.path}`,
              icon: Package,
              run: () => router.push(containerHref(item.containerId)),
            },
          ];
        })
      : [];

    const recipeCommands: Command[] = visible.has("recipes")
      ? (recipes ?? []).map((recipe) => ({
          id: `recipe:${recipe.id}`,
          group: "recipes",
          label: recipe.name,
          icon: ChefHat,
          keywords: recipe.keywords,
          run: () => router.push(recipeHref(recipe.id)),
        }))
      : [];

    // Listas y proyectos: "baño" encuentra el proyecto y sus listas.
    const listCommands: Command[] = [
      ...(visible.has("compras")
        ? (lists ?? [])
            .filter((summary) => !summary.list.archivedAt)
            .map((summary): Command => ({
              id: `list:${summary.list.id}`,
              group: "lists",
              label: summary.project ? `${listName(summary.list, t)} · ${summary.project.name}` : listName(summary.list, t),
              icon: ClipboardList,
              run: () => router.push(`/compras?lista=${summary.list.id}`),
            }))
        : []),
      ...(visible.has("projects")
        ? (projects ?? []).map((summary): Command => ({
            id: `project:${summary.project.id}`,
            group: "lists",
            label: summary.project.name,
            icon: HardHat,
            run: () => router.push(projectHref(summary.project.id)),
          }))
        : []),
    ];

    const pageCommands: Command[] = routes.filter((route) => !route.needsId && !(route.external && route.hidden)).map((route) => ({
      id: `page:${route.id}`,
      group: "pages",
      label: t(route.labelKey),
      icon: route.icon,
      keywords: route.href,
      run: () => router.push(route.href),
    }));

    const actionCommands: Command[] = [
      ...(visible.has("compras") && can(user, "shopping.manage")
        ? [{ id: "shopping:add", group: "actions" as const, label: t("palette.actions.shoppingAdd"), icon: ListPlus, keywords: "compras lista anotar", run: () => router.push("/compras") }]
        : []),
      ...(visible.has("scan")
        ? [{ id: "scan", group: "actions" as const, label: t("palette.actions.scan"), icon: ScanLine, keywords: "qr", run: () => router.push("/inventario/escanear") }]
        : []),
      { id: "theme:light", group: "actions", label: t("palette.actions.themeLight"), icon: Sun, run: () => setPreference("themeMode", "light") },
      { id: "theme:dark", group: "actions", label: t("palette.actions.themeDark"), icon: Moon, run: () => setPreference("themeMode", "dark") },
      { id: "theme:system", group: "actions", label: t("palette.actions.themeSystem"), icon: Monitor, run: () => setPreference("themeMode", "system") },
      ...LOCALES.filter((code) => code !== locale).map<Command>((code) => ({
        id: `locale:${code}`,
        group: "actions",
        label: t("palette.actions.language", { language: LOCALE_META[code].label }),
        icon: Languages,
        keywords: "idioma language",
        run: () => setPreference("locale", code),
      })),
      { id: "sidebar:expanded", group: "actions", label: t("palette.actions.sidebarExpanded"), icon: PanelLeft, run: () => setPreference("sidebar", "expanded") },
      { id: "sidebar:collapsed", group: "actions", label: t("palette.actions.sidebarCollapsed"), icon: PanelLeftClose, run: () => setPreference("sidebar", "collapsed") },
      { id: "sidebar:hidden", group: "actions", label: t("palette.actions.sidebarHidden"), icon: PanelLeftDashed, run: () => setPreference("sidebar", "hidden") },
      { id: "session:signout", group: "actions", label: t("palette.actions.signOut"), icon: LogOut, run: signOut },
    ];

    return [...recentCommands, ...pageCommands, ...containerCommands, ...itemCommands, ...recipeCommands, ...listCommands, ...actionCommands];
  }, [routes, recent, containers, items, recipes, lists, projects, user, t, locale, router, setPreference, signOut]);
}
