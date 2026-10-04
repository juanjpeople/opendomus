"use client";

import { create } from "zustand";

/**
 * Estado de la sincronización, para mostrarlo (indicador, Ajustes):
 * - `off`: casa solo en este dispositivo;
 * - `syncing`: subiendo o bajando;
 * - `synced`: al día;
 * - `offline`: sin conexión (los cambios quedan guardados y se suben al volver);
 * - `error`: algo impide sincronizar (ver `error`).
 */
export type SyncPhase = "off" | "syncing" | "synced" | "offline" | "error";

/** Por qué no se puede sincronizar (cada uno tiene su texto en `cloud.sync.errors.*`). */
export type SyncErrorCode = "session" | "keys-changed" | "rejected" | "server";

interface SyncStatusState {
  phase: SyncPhase;
  /** Cosas con cambios sin subir. */
  pending: number;
  lastSyncAt: number | null;
  error: SyncErrorCode | null;
  /** Cambios recibidos y descartados (firma inválida o sin permiso), desde que se abrió la app. */
  rejected: number;
  /** Bajando la casa por primera vez: cuánto va de cuánto. */
  progress: { done: number; total: number } | null;
  update: (patch: Partial<Omit<SyncStatusState, "update">>) => void;
}

export const useSyncStatus = create<SyncStatusState>()((set) => ({
  phase: "off",
  pending: 0,
  lastSyncAt: null,
  error: null,
  rejected: 0,
  progress: null,
  update: (patch) => set(patch),
}));
