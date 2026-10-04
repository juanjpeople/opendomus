"use client";

import { useEffect } from "react";
import { CLOUD_ENABLED } from "@/lib/cloud/api";
import { useMembersStore, useSessionStore } from "@/lib/auth/session";
import { startSync } from "@/lib/sync/engine";
import { getSyncLink } from "@/lib/sync/middleware";
import { useSyncStatus } from "@/lib/sync/status";
import { useDeviceStore } from "@/store/useDeviceStore";
import { restoreCloudSession, useCloudSession } from "../hooks";
import { syncContextFor } from "../sync";

/**
 * Con la casa en la nube, mantiene la sincronización andando mientras la app está abierta.
 * Sin conexión, la app sigue funcionando con la copia local y sube todo al volver.
 */
export function CloudSync() {
  const mode = useDeviceStore((s) => s.mode);
  const { status, session } = useCloudSession();
  const members = useMembersStore((s) => s.members);
  const currentProfileId = useSessionStore((s) => s.currentProfileId);
  const active = CLOUD_ENABLED && mode === "cloud";

  // Arranca el motor cuando hay sesión y la casa de este dispositivo es una casa de esa sesión.
  useEffect(() => {
    const link = getSyncLink();
    if (!active || !session || !link) return;
    const household = session.households.find((entry) => entry.id === link.householdId);
    if (!household || link.userId !== session.user.id) {
      useSyncStatus.getState().update({ phase: "error", error: "session" });
      return;
    }
    let stop: (() => void) | undefined;
    let cancelled = false;
    syncContextFor(session, household, link)
      .then((context) => {
        if (!cancelled) stop = startSync(context);
      })
      .catch(() => useSyncStatus.getState().update({ phase: "error", error: "session" }));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [active, session]);

  // Sin sesión: si es por falta de conexión, se reintenta al volver; si no, hay que volver a entrar.
  useEffect(() => {
    if (!active) return;
    if (status === "offline") {
      useSyncStatus.getState().update({ phase: "offline" });
      const retry = () => void restoreCloudSession();
      window.addEventListener("online", retry);
      const timer = setInterval(retry, 60_000);
      return () => {
        window.removeEventListener("online", retry);
        clearInterval(timer);
      };
    }
    if (status === "signed-out") useSyncStatus.getState().update({ phase: "error", error: "session" });
  }, [active, status]);

  // En un dispositivo personal entra directo con el perfil de su cuenta (sin "¿Quién está en casa?").
  useEffect(() => {
    if (!active || !session || !members || currentProfileId) return;
    const mine = members.find((member) => member.userId === session.user.id);
    if (mine) useSessionStore.getState().signIn(mine.id);
  }, [active, session, members, currentProfileId]);

  return null;
}
