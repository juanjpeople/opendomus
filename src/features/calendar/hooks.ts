"use client";

import { App } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { useMembers } from "@/features/members/hooks";
import { useI18n, useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { canSee } from "@/lib/sync/scope";
import { applySchoolBreaks, birthdayOccurrences, compareOccurrences, expandEvents, type EventInput, type Occurrence } from "./domain";
import { holidayOccurrences } from "./holidays";
import { DEFAULT_CALENDAR } from "./settings";
import { createEvent, deleteEvent, updateEvent } from "./service";

/**
 * Ocurrencias (eventos expandidos + cumpleaños) en [from, to), ordenadas.
 * Los repetidos se leen todos (son pocos); los únicos, solo los cercanos al rango.
 */
export function useOccurrences(from: number, to: number): Occurrence[] | undefined {
  const { locale } = useI18n();
  const preferences = useLiveQuery(() => db.houseSettings.get("calendar"));
  const members = useMembers();
  const viewer = useCurrentUser();
  const events = useLiveQuery(async () => {
    const [single, repeating] = await Promise.all([
      // Includes long school vacations starting before the visible range.
      db.events.where("start").below(to).filter((event) => event.repeat === "none" && event.end + (event.allDay ? 86_400_000 : 0) > from).toArray(),
      db.events.where("repeat").notEqual("none").toArray(),
    ]);
    return [...single, ...repeating].filter((event) => canSee(viewer, event));
  }, [from, to, viewer?.id, viewer?.role]);

  return useMemo(() => {
    if (!events || !members) return undefined;
    return [...applySchoolBreaks(expandEvents(events, from, to)), ...birthdayOccurrences(members, from, to), ...holidayOccurrences(preferences ?? DEFAULT_CALENDAR, from, to, locale)].sort(compareOccurrences);
  }, [events, members, from, to, preferences, locale]);
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
