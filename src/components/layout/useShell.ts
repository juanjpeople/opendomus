"use client";

import { Grid } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { usePreferences, useSetPreference } from "@/hooks/usePreferences";
import { useT } from "@/i18n";
import { isSecured } from "@/features/members/domain";
import { useCurrentUser, useLockStore } from "@/lib/auth/session";
import { findRoute } from "@/lib/navigation/routes";
import { useBreadcrumbStore } from "@/store/useBreadcrumbStore";
import { useNavigationStore, useUiStore } from "@/store/useNavigationStore";

/**
 * Botón de menú: en escritorio alterna completo ↔ solo íconos; si el menú está oculto
 * (o en mobile), abre el Drawer.
 */
export function useToggleSidebar() {
  const screens = Grid.useBreakpoint();
  const { sidebar } = usePreferences();
  const setPreference = useSetPreference();
  const setNavDrawerOpen = useUiStore((s) => s.setNavDrawerOpen);
  const usesDrawer = !screens.md || sidebar === "hidden";

  return useCallback(() => {
    if (usesDrawer) setNavDrawerOpen(true);
    else setPreference("sidebar", sidebar === "expanded" ? "collapsed" : "expanded");
  }, [usesDrawer, sidebar, setPreference, setNavDrawerOpen]);
}

/** Atajos globales: Ctrl/⌘+K búsqueda, Ctrl/⌘+B menú, Ctrl/⌘+, ajustes. */
export function useGlobalShortcuts() {
  const router = useRouter();
  const toggleSidebar = useToggleSidebar();
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setPaletteOpen(!useUiStore.getState().paletteOpen);
      } else if (key === "b") {
        event.preventDefault();
        toggleSidebar();
      } else if (key === ",") {
        event.preventDefault();
        router.push("/ajustes");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, toggleSidebar, setPaletteOpen]);
}

/** Registra cada página visitada (para "Recientes") y pone el título de la pestaña en el idioma activo. */
export function useNavigationTracking() {
  const t = useT();
  const pathname = usePathname();
  const user = useCurrentUser();
  const visit = useNavigationStore((s) => s.visit);
  const tail = useBreadcrumbStore((s) => s.tail);
  const route = findRoute(pathname);

  // Se guarda la URL real (ej. /inventario/<id>), así "Recientes" lleva al contenedor exacto.
  useEffect(() => {
    if (user && route) visit(user.id, pathname);
  }, [user, route, pathname, visit]);

  useEffect(() => {
    if (route) document.title = `${tail.at(-1)?.label ?? t(route.labelKey)} · ${t("common.appName")}`;
  }, [route, tail, t]);
}

/**
 * Bloqueo por inactividad para perfiles protegidos. También al volver a la pestaña o recargar
 * después del tiempo configurado (la última actividad vive en sessionStorage).
 */
export function useAutoLock() {
  const user = useCurrentUser();
  const { autoLockMinutes } = usePreferences();
  const touch = useLockStore((s) => s.touch);
  const lock = useLockStore((s) => s.lock);
  const secured = !!user && isSecured(user);

  useEffect(() => {
    if (!secured || autoLockMinutes === 0) return;
    const limit = autoLockMinutes * 60_000;
    let lastTouch = 0;
    const onActivity = () => {
      const now = Date.now();
      // Como mucho una escritura cada 10 s: la actividad es muy frecuente.
      if (now - lastTouch > 10_000) {
        lastTouch = now;
        touch();
      }
    };
    const check = () => {
      if (Date.now() - useLockStore.getState().lastActivity > limit) lock();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", check);
    const interval = setInterval(check, 15_000);
    check();
    return () => {
      events.forEach((name) => window.removeEventListener(name, onActivity));
      document.removeEventListener("visibilitychange", check);
      clearInterval(interval);
    };
  }, [secured, autoLockMinutes, touch, lock]);
}
