"use client";

import { useSyncExternalStore } from "react";
import { useSessionStore } from "@/lib/auth/session";
import { usePreferencesStore } from "@/store/usePreferencesStore";

const stores = [useSessionStore, usePreferencesStore];

function subscribe(onChange: () => void) {
  const unsubscribers = stores.map((store) => store.persist.onFinishHydration(onChange));
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

const getSnapshot = () => stores.every((store) => store.persist.hasHydrated());
const getServerSnapshot = () => false;

/**
 * `true` cuando los stores persistidos ya leyeron localStorage.
 * Evita renderizar con valores por defecto (y los mismatches de hidratación) sin
 * recurrir al patrón `useEffect(() => setMounted(true))`.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
