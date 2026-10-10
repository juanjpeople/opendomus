"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LabelSize = "small" | "brother" | "sheet" | "shelf";

/**
 * Medidas en mm. Rollos: una etiqueta por página. Hoja A4: grilla de 3 columnas (tipo 63,5 × 38,1 mm).
 * Estante: 100 × 50 mm, dos por fila; su QR de unos 46 mm se lee desde la otra punta del taller.
 */
export const LABEL_SIZES: Record<LabelSize, { width: number; height: number; page: string; perRow: number }> = {
  small: { width: 50, height: 25, page: "50mm 25mm", perRow: 1 },
  brother: { width: 62, height: 29, page: "62mm 29mm", perRow: 1 },
  sheet: { width: 63.5, height: 38.1, page: "A4", perRow: 3 },
  shelf: { width: 100, height: 50, page: "A4", perRow: 2 },
};

/** URL que abre el QR de un contenedor. */
export function containerQrUrl(baseUrl: string, code: string) {
  return `${baseUrl.replace(/\/+$/, "")}/c/${code}`;
}

export function isLocalhostUrl(url: string) {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

interface LabelSettings {
  /** Vacío = la dirección actual del navegador. */
  baseUrl: string;
  size: LabelSize;
  setBaseUrl: (baseUrl: string) => void;
  setSize: (size: LabelSize) => void;
}

/** Preferencias de impresión del dispositivo (la impresora y la red son del equipo, no del perfil). */
export const useLabelSettings = create<LabelSettings>()(
  persist(
    (set) => ({
      baseUrl: "",
      size: "brother",
      setBaseUrl: (baseUrl) => set({ baseUrl: baseUrl.trim() }),
      setSize: (size) => set({ size }),
    }),
    { name: "refugiar-labels", version: 1 },
  ),
);
