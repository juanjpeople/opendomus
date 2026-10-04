"use client";

import { useSyncExternalStore } from "react";
import { usePreferences } from "@/hooks/usePreferences";

const QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(QUERY).matches;
const getServerSnapshot = () => false;

/** Modo oscuro efectivo: preferencia del usuario o, en "system", la del sistema operativo (en vivo). */
export function useIsDark(): boolean {
  const { themeMode } = usePreferences();
  const systemIsDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return themeMode === "dark" || (themeMode === "system" && systemIsDark);
}
