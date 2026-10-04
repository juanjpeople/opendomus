"use client";

import { App } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { useMembers } from "@/features/members/hooks";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { birthdayOccurrences, compareOccurrences, expandEvents, type EventInput, type Occurrence } from "./domain";
import { createEvent, deleteEvent, updateEvent } from "./service";

/**
 * Ocurrencias (eventos expandidos + cumpleaños) en [from, to), ordenadas.
 * Los repetidos se leen todos (son pocos); los únicos, solo los cercanos al rango.
 */
export function useOccurrences(from: number, to: number): Occurrence[] | undefined {
  const members = useMembers();
  const events = useLiveQuery(async () => {
    const [single, repeating] = await Promise.all([
      // Un evento de varios días que empezó antes del rango también cuenta: margen de 60 días.
      db.events.where("start").between(from - 60 * 86_400_000, to).filter((event) => event.repeat === "none").toArray(),
      db.events.where("repeat").notEqual("none").toArray(),
    ]);
    return [...single, ...repeating];
  }, [from, to]);

  return useMemo(() => {
    if (!events || !members) return undefined;
    return [...expandEvents(events, from, to), ...birthdayOccurrences(members, from, to)].sort(compareOccurrences);
  }, [events, members, from, to]);
}

export function useEventActions() {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const t = useT();

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      message.success(success);
      return true;
    } catch (error) {
      message.error(getErrorMessage(error, t));
      return false;
    }
  }

  return {
    create: (input: EventInput) => run(() => createEvent(user, input), t("calendar.toast.created")),
    update: (id: string, input: EventInput) => run(() => updateEvent(user, id, input), t("calendar.toast.saved")),
    remove: (id: string) => run(() => deleteEvent(user, id), t("calendar.toast.deleted")),
  };
}
