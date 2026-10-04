"use client";

import { App } from "antd";
import { useT } from "@/i18n";
import { useCurrentUser, useLockStore, useMembersStore } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/errors";
import type { BiometricCredential, MemberInput } from "./domain";
import { addCredential, createMember, deleteMember, removeCredential, removePin, setPin, updateMember } from "./service";

/** Miembros de la casa (en memoria, sin esperar a la base). `null` mientras carga. */
export function useMembers() {
  return useMembersStore((s) => s.members);
}

export function useMemberActions() {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const t = useT();

  async function run(action: () => Promise<unknown>, success?: string) {
    try {
      await action();
      if (success) message.success(success);
      return true;
    } catch (error) {
      message.error(getErrorMessage(error, t));
      return false;
    }
  }

  // Quien se protege a sí mismo ya está adentro: la sesión actual queda desbloqueada
  // (antes de escribir, así el perfil nunca aparece "protegido y bloqueado" ni por un instante).
  const keepUnlocked = (id: string) => {
    if (user?.id === id) useLockStore.getState().unlock(id);
  };

  return {
    create: (input: MemberInput) => run(() => createMember(user, input), t("members.toast.created")),
    update: (id: string, input: MemberInput) => run(() => updateMember(user, id, input), t("members.toast.saved")),
    remove: (id: string) => run(() => deleteMember(user, id), t("members.toast.deleted")),
    setPin: (id: string, pin: string) => {
      keepUnlocked(id);
      return run(() => setPin(user, id, pin), t("members.toast.pinSaved"));
    },
    removePin: (id: string) => run(() => removePin(user, id), t("members.toast.pinRemoved")),
    addCredential: (id: string, credential: BiometricCredential) => {
      keepUnlocked(id);
      return run(() => addCredential(user, id, credential), t("members.toast.biometricAdded"));
    },
    removeCredential: (id: string, credentialId: string) => run(() => removeCredential(user, id, credentialId), t("members.toast.biometricRemoved")),
  };
}
