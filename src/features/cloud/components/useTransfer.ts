"use client";

import { useCallback, useState } from "react";
import { useT } from "@/i18n";
import { getErrorMessage } from "@/lib/errors";
import type { Progress } from "../sync";
import type { TransferState } from "./HouseTransfer";

/** Corre una subida o bajada de la casa con su progreso; si falla, guarda el error para reintentar. */
export function useTransfer() {
  const t = useT();
  const [state, setState] = useState<TransferState>({ done: 0, total: 0, error: null });

  const run = useCallback(
    async (task: (progress: Progress) => Promise<unknown>): Promise<boolean> => {
      setState({ done: 0, total: 0, error: null });
      try {
        await task((done, total) => setState({ done, total, error: null }));
        return true;
      } catch (error) {
        setState((current) => ({ ...current, error: getErrorMessage(error, t) }));
        return false;
      }
    },
    [t],
  );

  return { state, run };
}
