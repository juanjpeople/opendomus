"use client";

import { createContext, useContext } from "react";
import { SKINS } from "./skins";
import type { Skin } from "./types";

/**
 * El skin vigente. Lo provee `ThemeProvider` (según las preferencias del perfil); fuera de él, como en
 * el panel del operador, vale "Casa". No lee el store a propósito: así las piezas compartidas no arrastran
 * sesión ni base de datos a quien no las usa.
 */
export const SkinContext = createContext<Skin>(SKINS.casa);

export function useSkin(): Skin {
  return useContext(SkinContext);
}
