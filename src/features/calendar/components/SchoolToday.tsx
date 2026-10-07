"use client";

import { App, Button, Card, Flex, Typography } from "antd";
import dayjs from "dayjs";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { useNow } from "@/hooks/useNow";
import { useMembers } from "@/features/members/hooks";
import { usePermission } from "@/lib/auth/hooks";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { canSee } from "@/lib/sync/scope";
import { useOccurrences } from "../hooks";
import { updateEvent } from "../service";
import type { CalendarEvent } from "../domain";

export function SchoolToday() {
  const settings = useLiveQuery(() => db.houseSettings.get("calendar"));
  return settings?.schoolEnabled ? <SchoolAgenda /> : null;
}

function SchoolAgenda() {
  const now = useNow();
  const today = dayjs(now).startOf("day");
  const from = today.valueOf();
  const to = today.add(1, "day").valueOf();
  const occurrences = useOccurrences(from, to) ?? [];
  const members = useMembers() ?? [];
  const actor = useCurrentUser();
  const canManage = usePermission("calendar.manage");
  const { locale, format, t } = useI18n();
  const es = locale === "es";
  const { message } = App.useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const homework = useLiveQuery(() => db.events.where("start").below(to).filter((event) => event.eventKind === "homework" && !event.homeworkDone && canSee(actor, event)).toArray(), [to, actor?.id, actor?.role]) ?? [];
  const pupils = members.filter((member) => canManage || member.id === actor?.id);
  async function complete(event: CalendarEvent) {
    setBusy(event.id);
    try { await updateEvent(actor, event.id, { ...event, homeworkDone: true }); }
    catch (error) { message.error(getErrorMessage(error, t)); }
    finally { setBusy(null); }
  }
  return <Card title={es ? "Escuela hoy · mochila y tareas" : "School today · backpack and homework"} style={{ marginBottom: 20 }} extra={<Link href="/calendario">{es ? "Calendario" : "Calendar"}</Link>}>
    <Flex vertical gap={16}>
      {occurrences.filter((entry) => entry.holiday || entry.event?.eventKind === "holiday").map((entry) => <Typography.Text key={entry.key} type="warning">{entry.title} · {es ? "Confirmá si hay clases" : "Check whether school is open"}</Typography.Text>)}
      {pupils.map((member) => {
        const classes = occurrences.filter((entry) => entry.event?.eventKind === "class" && entry.participantIds.includes(member.id)).sort((a, b) => a.start - b.start);
        const tasks = homework.filter((event) => !event.participantIds.length || event.participantIds.includes(member.id));
        if (!classes.length && !tasks.length) return null;
        return <section key={member.id}>
          <Typography.Title level={5} style={{ marginTop: 0 }}>{member.name}</Typography.Title>
          {classes.map((entry) => <div key={entry.key} style={{ marginBottom: 8 }}>
            <Typography.Text strong>{format.date(entry.start, { hour: "2-digit", minute: "2-digit" })} · {entry.title}</Typography.Text>
            {entry.event?.notes && <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 8 }}>{entry.event.notes}</Typography.Paragraph>}
          </div>)}
          {tasks.map((event) => <Flex key={event.id} justify="space-between" gap={12} align="center" wrap>
            <div><Typography.Text>{es ? "Revisar tarea" : "Check homework"}: {event.title} · {format.date(event.start, { day: "numeric", month: "short" })}</Typography.Text>
              {event.notes && <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>{event.notes}</Typography.Paragraph>}</div>
            {canManage && <Button loading={busy === event.id} disabled={busy !== null} onClick={() => void complete(event)}>{es ? "Marcar revisada" : "Mark checked"}</Button>}
          </Flex>)}
        </section>;
      })}
      {!occurrences.some((entry) => entry.event?.eventKind === "class" && pupils.some((member) => entry.participantIds.includes(member.id))) && <Typography.Text type="secondary">{es ? "No hay materias programadas para hoy." : "No subjects scheduled today."}</Typography.Text>}
      {canManage && <Typography.Text type="secondary">{es ? "En Calendario → Nuevo evento, elegí Materia escolar o Tarea escolar y asigná el hijo que corresponda. Las tareas pendientes siguen visibles hasta revisarlas." : "In Calendar → New event, choose School subject or Homework and the child. Pending homework remains visible until checked."}</Typography.Text>}
    </Flex>
  </Card>;
}
