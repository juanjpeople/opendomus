"use client";

import { App } from "antd";
import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { summarizePrices, type NewPrice, type PriceSummary } from "./domain";
import { addPrice, deletePrice } from "./service";

/** Historial de precios de un producto, del más nuevo al más viejo. */
export function usePrices(itemId: string | null) {
  return useLiveQuery(
    () =>
      itemId
        ? db.prices.where("[itemId+at]").between([itemId, Dexie.minKey], [itemId, Dexie.maxKey]).reverse().toArray()
        : [],
    [itemId],
  );
}

/** Resumen de precios de todos los productos de un contenedor (para la lista). */
export function usePriceSummaries(containerId: string) {
  return useLiveQuery(async () => {
    const itemIds = await db.inventory.where("containerId").equals(containerId).primaryKeys();
    const records = await db.prices.where("itemId").anyOf(itemIds).toArray();
    const summaries = new Map<string, PriceSummary>();
    for (const itemId of itemIds) {
      const summary = summarizePrices(records.filter((record) => record.itemId === itemId));
      if (summary) summaries.set(itemId, summary);
    }
    return summaries;
  }, [containerId]);
}

/** Tiendas usadas antes (para autocompletar). */
export function useKnownStores() {
  return useLiveQuery(async () => (await db.prices.orderBy("store").uniqueKeys()).filter(Boolean) as string[]);
}

export function usePriceActions() {
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

  return {
    add: (input: NewPrice) => run(() => addPrice(user, input), t("prices.toast.added")),
    remove: (id: string) => run(() => deletePrice(user, id)),
  };
}
