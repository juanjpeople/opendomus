"use client";

import { usePreferences } from "@/hooks/usePreferences";
import { getSkin } from "./skins";
import type { Skin } from "./types";

/** El skin del perfil actual (el de "Casa" antes de hidratar, igual que el resto de las preferencias). */
export function useSkin(): Skin {
  return getSkin(usePreferences().skin);
}
