"use client";

import { App } from "antd";
import { useEffect } from "react";
import { create } from "zustand";
import { useT } from "@/i18n";
import { CLOUD_ENABLED } from "@/lib/cloud/api";
import { getErrorMessage } from "@/lib/errors";
import * as service from "./service";
import type { CloudSession } from "./service";

/** `offline`: no se pudo preguntar (sin conexión o servidor caído); se reintenta al volver la conexión. */
type Status = "idle" | "restoring" | "signed-out" | "offline" | "ready";

/**
 * Sesión de la nube en memoria (la identidad son CryptoKey no exportables: no se persiste en
 * localStorage; vuelve del llavero del dispositivo al recargar).
 */
interface CloudState {
  status: Status;
  session: CloudSession | null;
  setSession: (session: CloudSession | null) => void;
  setStatus: (status: Status) => void;
}

export const useCloudStore = create<CloudState>()((set) => ({
  status: "idle",
  session: null,
  setSession: (session) => set({ session, status: session ? "ready" : "signed-out" }),
  setStatus: (status) => set({ status }),
}));

/** Recupera la sesión (cookie + llavero del dispositivo). */
export async function restoreCloudSession() {
  if (useCloudStore.getState().status === "restoring") return;
  useCloudStore.getState().setStatus("restoring");
  try {
    useCloudStore.getState().setSession(await service.restoreSession());
  } catch {
    useCloudStore.getState().setStatus("offline");
  }
}

/** La sesión de la nube; la primera vez que se pide, la recupera. */
export function useCloudSession() {
  const status = useCloudStore((s) => s.status);
  const session = useCloudStore((s) => s.session);

  useEffect(() => {
    if (CLOUD_ENABLED && useCloudStore.getState().status === "idle") void restoreCloudSession();
  }, []);

  return { status: CLOUD_ENABLED ? status : ("signed-out" as Status), session };
}

/** Acciones que muestran el error traducido y devuelven `null` si fallan. */
export function useCloudActions() {
  const t = useT();
  const { message } = App.useApp();

  async function run<T>(action: () => Promise<T>): Promise<T | null> {
    try {
      return await action();
    } catch (error) {
      message.error(getErrorMessage(error, t));
      return null;
    }
  }

  const refresh = async () => {
    const session = useCloudStore.getState().session;
    if (!session) return;
    const households = await service.refreshHouseholds(session);
    useCloudStore.getState().setSession({ ...session, households });
  };

  return {
    signUp: (input: { name: string; email: string; password: string }) =>
      run(async () => {
        const result = await service.signUp(input);
        useCloudStore.getState().setSession(result.session);
        return result;
      }),
    /** Con la verificación en dos pasos devuelve `secondStep`: falta el código o la llave. */
    signIn: (input: { email: string; password: string }) =>
      run(async () => {
        const result = await service.signIn(input);
        if ("session" in result) useCloudStore.getState().setSession(result.session);
        return result;
      }),
    recover: (input: { email: string; recoveryCode: string; password: string }) =>
      run(async () => {
        const result = await service.recoverAccount(input);
        if ("session" in result) useCloudStore.getState().setSession(result.session);
        return result;
      }),
    /** Termina un ingreso que quedó esperando el segundo paso (ya verificado). */
    finishSecondStep: (step: service.SecondStep) =>
      run(async () => {
        const session = await step.finish();
        useCloudStore.getState().setSession(session);
        return session;
      }),
    signOut: () =>
      run(async () => {
        await service.signOut();
        useCloudStore.getState().setSession(null);
        return true;
      }),
    createHousehold: (name: string, accessCode: string) =>
      run(async () => {
        const session = useCloudStore.getState().session!;
        const id = await service.createHousehold(session, name, accessCode);
        await refresh();
        return id;
      }),
    acceptInvite: (id: string, secret: string) =>
      run(async () => {
        const householdId = await service.acceptInvite(useCloudStore.getState().session!, id, secret);
        await refresh();
        return householdId;
      }),
    refresh: () => run(refresh),
  };
}
