"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

/** Subconjunto de la Navigation API (Chromium, Firefox y Safari recientes). */
interface NavigationApi extends EventTarget {
  canGoBack: boolean;
  canGoForward: boolean;
}

function getNavigationApi(): NavigationApi | undefined {
  return typeof window !== "undefined" ? (window as Window & { navigation?: NavigationApi }).navigation : undefined;
}

function subscribe(onChange: () => void) {
  const api = getNavigationApi();
  let active = true;
  let queued = false;
  const onEntryChange = () => {
    if (queued) return;
    queued = true;
    // Next.js cambia el historial en useInsertionEffect: notificar fuera de esa fase.
    queueMicrotask(() => {
      queued = false;
      if (active) onChange();
    });
  };
  api?.addEventListener("currententrychange", onEntryChange);
  return () => {
    active = false;
    api?.removeEventListener("currententrychange", onEntryChange);
  };
}

// Sin Navigation API no se puede saber si hay historial: los botones quedan siempre habilitados.
const getSnapshot = () => {
  const api = getNavigationApi();
  return api ? `${api.canGoBack}|${api.canGoForward}` : "true|true";
};
const getServerSnapshot = () => "false|false";

/** Atrás/adelante del navegador, con estado habilitado/deshabilitado en vivo cuando se puede. */
export function useHistoryNavigation() {
  const router = useRouter();
  const [canGoBack, canGoForward] = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot).split("|");

  return {
    canGoBack: canGoBack === "true",
    canGoForward: canGoForward === "true",
    back: () => router.back(),
    forward: () => router.forward(),
  };
}
