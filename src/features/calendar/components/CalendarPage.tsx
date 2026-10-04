"use client";

import { Button, Flex, Grid, Segmented, Skeleton, Tooltip, Typography, theme } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Can } from "@/components/auth/Can";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { PageHeader } from "@/components/ui";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { useMembers } from "@/features/members/hooks";
import { useI18n } from "@/i18n";
import { APPEARANCE_ICONS, tint } from "@/lib/appearance";
import { usePermission } from "@/lib/auth/hooks";
import { DURATION, EASE_OUT } from "@/lib/motion";
import type { CalendarEvent, Occurrence } from "../domain";
import { useOccurrences } from "../hooks";
import { EventModal } from "./EventModal";

type View = "week" | "month";

/** Inicio de semana según el idioma: lunes en español, domingo en inglés. */
function startOfWeek(date: Dayjs, locale: string) {
  const offset = locale === "en" ? date.day() : (date.day() + 6) % 7;
  return date.subtract(offset, "day").startOf("day");
}

/** ¿La ocurrencia cae en este día? (los de todo el día pueden abarcar varios). */
function onDay(occurrence: Occurrence, day: Dayjs) {
  const start = dayjs(occurrence.start).startOf("day");
  const end = occurrence.allDay ? dayjs(occurrence.end).startOf("day") : start;
  return !day.isBefore(start) && !day.isAfter(end);
}

export function CalendarPage() {
  const { t, locale, format } = useI18n();
  const screens = Grid.useBreakpoint();
  const members = useMembers() ?? [];
  const canManage = usePermission("calendar.manage");
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(() => dayjs().startOf("day"));
  const [direction, setDirection] = useState(1);
  const [filter, setFilter] = useState<string | null>(null);
  const [modal, setModal] = useState<{ event?: CalendarEvent; day?: Dayjs } | null>(null);

  const days = useMemo(() => {
    const first = view === "week" ? startOfWeek(cursor, locale) : startOfWeek(cursor.startOf("month"), locale);
    return Array.from({ length: view === "week" ? 7 : 42 }, (_, index) => first.add(index, "day"));
  }, [view, cursor, locale]);

  const from = days[0].valueOf();
  const to = days[days.length - 1].add(1, "day").valueOf();
  const occurrences = useOccurrences(from, to);
  const visible = (occurrences ?? []).filter((occurrence) => !filter || occurrence.participantIds.length === 0 || occurrence.participantIds.includes(filter));

  const move = (step: number) => {
    setDirection(step);
    setCursor((current) => current.add(step, view));
  };

  const rawTitle =
    view === "month"
      ? format.date(cursor.valueOf(), { month: "long", year: "numeric" })
      : `${format.date(days[0].valueOf(), { day: "numeric", month: "short" })} – ${format.date(days[6].valueOf(), { day: "numeric", month: "short", year: "numeric" })}`;
  // Solo la primera letra en mayúscula ("Octubre de 2026", no "Octubre De 2026").
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

  const openOccurrence = (occurrence: Occurrence) => occurrence.event && setModal({ event: occurrence.event });
  const addOn = (day: Dayjs) => canManage && setModal({ day });

  return (
    <RequirePermission perform="calendar.view">
      <PageHeader
        eyebrow={t("calendar.eyebrow")}
        title={t("calendar.title")}
        description={t("calendar.description")}
        extra={
          <Can perform="calendar.manage">
            <Button type="primary" icon={<Plus />} onClick={() => setModal({ day: cursor })}>
              {t("calendar.newEvent")}
            </Button>
          </Can>
        }
      />

      {/* Barra: período, navegación, vista y filtro por miembro. */}
      <Flex align="center" justify="space-between" gap={12} wrap style={{ marginBottom: 16 }}>
        <Flex align="center" gap={8} wrap style={{ minWidth: 0 }}>
          <Button style={!screens.md ? { width: 44, height: 44 } : undefined} icon={<ChevronLeft />} aria-label={t("calendar.prev")} onClick={() => move(-1)} />
          <Button style={!screens.md ? { minHeight: 44 } : undefined} onClick={() => { setDirection(cursor.isAfter(dayjs()) ? -1 : 1); setCursor(dayjs().startOf("day")); }}>{t("calendar.today")}</Button>
          <Button style={!screens.md ? { width: 44, height: 44 } : undefined} icon={<ChevronRight />} aria-label={t("calendar.next")} onClick={() => move(1)} />
          <Typography.Title level={4} style={{ margin: screens.md ? "0 0 0 8px" : 0, width: screens.md ? undefined : "100%" }}>
            {title}
          </Typography.Title>
        </Flex>
        <Flex align="center" gap={12} wrap>
          <Flex gap={4} align="center" wrap>
            {members.map((member) => (
              <Tooltip key={member.id} title={member.name}>
                <motion.button
                  type="button"
                  aria-pressed={filter === member.id}
                  aria-label={member.name}
                  onClick={() => setFilter((current) => (current === member.id ? null : member.id))}
                  whileHover={{ y: -2 }}
                  animate={{ opacity: !filter || filter === member.id ? 1 : 0.35, scale: filter === member.id ? 1.12 : 1 }}
                  style={{ border: "none", background: "transparent", padding: screens.md ? 0 : 7, cursor: "pointer", display: "inline-flex" }}
                >
                  <MemberAvatar member={member} size={30} />
                </motion.button>
              </Tooltip>
            ))}
          </Flex>
          <Segmented<View>
            value={view}
            onChange={setView}
            options={[
              { value: "week", label: t("calendar.week") },
              { value: "month", label: t("calendar.month") },
            ]}
          />
        </Flex>
      </Flex>

      {!occurrences ? (
        <Skeleton active />
      ) : (
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={`${view}:${from}`}
            custom={direction}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={{ duration: DURATION.fast, ease: EASE_OUT }}
          >
            {view === "week" ? (
              <WeekView days={days} occurrences={visible} stacked={!screens.md} onOpen={openOccurrence} onAdd={canManage ? addOn : undefined} />
            ) : (
              <MonthView
                days={days}
                month={cursor.month()}
                occurrences={visible}
                onOpen={openOccurrence}
                onAdd={canManage ? addOn : undefined}
                onShowDay={(day) => {
                  setCursor(day);
                  setView("week");
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <EventModal open={!!modal} event={modal?.event} day={modal?.day} onClose={() => setModal(null)} />
    </RequirePermission>
  );
}

function DayHeader({ day }: { day: Dayjs }) {
  const { token } = theme.useToken();
  const { format } = useI18n();
  const today = day.isSame(dayjs(), "day");
  return (
    <Flex align="center" gap={8}>
      <Typography.Text type="secondary" style={{ textTransform: "uppercase", fontSize: token.fontSizeSM, letterSpacing: "0.06em" }}>
        {format.date(day.valueOf(), { weekday: "short" })}
      </Typography.Text>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 28,
          height: 28,
          borderRadius: 14,
          fontWeight: 600,
          background: today ? token.colorPrimary : "transparent",
          color: today ? token.colorTextLightSolid : token.colorText,
        }}
      >
        {day.date()}
      </span>
    </Flex>
  );
}

function WeekView({
  days,
  occurrences,
  stacked,
  onOpen,
  onAdd,
}: {
  days: Dayjs[];
  occurrences: Occurrence[];
  stacked: boolean;
  onOpen: (occurrence: Occurrence) => void;
  onAdd?: (day: Dayjs) => void;
}) {
  const { token } = theme.useToken();
  const { t } = useI18n();

  return (
    <div style={{ display: "grid", gridTemplateColumns: stacked ? "1fr" : "repeat(7, minmax(0, 1fr))", gap: 10 }}>
      {days.map((day) => {
        const items = occurrences.filter((occurrence) => onDay(occurrence, day));
        const today = day.isSame(dayjs(), "day");
        return (
          <div
            key={day.valueOf()}
            style={{
              minHeight: stacked ? undefined : 360,
              padding: 10,
              borderRadius: token.borderRadiusLG,
              border: `1px solid ${today ? token.colorPrimaryBorder : token.colorBorderSecondary}`,
              background: today ? token.colorPrimaryBg : token.colorBgContainer,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <Flex justify="space-between" align="center">
              <DayHeader day={day} />
              {onAdd && <Button type="text" size="small" icon={<Plus />} aria-label={t("calendar.newEvent")} onClick={() => onAdd(day)} />}
            </Flex>
            {items.length === 0 && stacked && (
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {t("calendar.empty")}
              </Typography.Text>
            )}
            {items.map((occurrence) => (
              <EventChip key={occurrence.key} occurrence={occurrence} onOpen={onOpen} detailed />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function MonthView({
  days,
  month,
  occurrences,
  onOpen,
  onAdd,
  onShowDay,
}: {
  days: Dayjs[];
  month: number;
  occurrences: Occurrence[];
  onOpen: (occurrence: Occurrence) => void;
  onAdd?: (day: Dayjs) => void;
  onShowDay: (day: Dayjs) => void;
}) {
  const { token } = theme.useToken();
  const { t, format } = useI18n();
  const MAX = 3;

  return (
    <div style={{ borderRadius: token.borderRadiusLG, border: `1px solid ${token.colorBorderSecondary}`, overflow: "hidden", background: token.colorBgContainer }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        {days.slice(0, 7).map((day) => (
          <Typography.Text key={day.valueOf()} type="secondary" style={{ padding: "8px 10px", textTransform: "uppercase", fontSize: token.fontSizeSM, letterSpacing: "0.06em" }}>
            {format.date(day.valueOf(), { weekday: "short" })}
          </Typography.Text>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
        {days.map((day, index) => {
          const items = occurrences.filter((occurrence) => onDay(occurrence, day));
          const today = day.isSame(dayjs(), "day");
          const outside = day.month() !== month;
          return (
            <div
              key={day.valueOf()}
              role={onAdd ? "button" : undefined}
              tabIndex={onAdd ? 0 : undefined}
              onClick={(event) => event.target === event.currentTarget && onAdd?.(day)}
              style={{
                minHeight: 112,
                padding: 6,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                borderInlineStart: index % 7 ? `1px solid ${token.colorBorderSecondary}` : "none",
                borderTop: index >= 7 ? `1px solid ${token.colorBorderSecondary}` : "none",
                background: outside ? token.colorFillQuaternary : "transparent",
                opacity: outside ? 0.6 : 1,
                cursor: onAdd ? "pointer" : "default",
              }}
            >
              <span
                style={{
                  alignSelf: "flex-start",
                  minWidth: 24,
                  height: 24,
                  borderRadius: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: token.fontSizeSM,
                  fontWeight: today ? 700 : 400,
                  background: today ? token.colorPrimary : "transparent",
                  color: today ? token.colorTextLightSolid : token.colorText,
                  pointerEvents: "none",
                }}
              >
                {day.date()}
              </span>
              {items.slice(0, MAX).map((occurrence) => (
                <EventChip key={occurrence.key} occurrence={occurrence} onOpen={onOpen} />
              ))}
              {items.length > MAX && (
                <Button type="link" size="small" style={{ padding: 0, height: "auto", alignSelf: "flex-start" }} onClick={() => onShowDay(day)}>
                  {t("calendar.more", { count: items.length - MAX })}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Evento en el calendario: color propio, ícono, horario y quiénes participan. */
function EventChip({ occurrence, onOpen, detailed = false }: { occurrence: Occurrence; onOpen: (occurrence: Occurrence) => void; detailed?: boolean }) {
  const { token } = theme.useToken();
  const { t, format } = useI18n();
  const members = useMembers() ?? [];
  const palette = tint(token, occurrence.color);
  const Icon = occurrence.icon ? APPEARANCE_ICONS[occurrence.icon] : null;
  const title = occurrence.birthdayOf ? t("calendar.birthday", { name: occurrence.title }) : occurrence.title;
  const time = occurrence.allDay ? t("calendar.allDay") : `${format.time(occurrence.start)}${occurrence.end > occurrence.start ? ` – ${format.time(occurrence.end)}` : ""}`;
  const participants = members.filter((member) => occurrence.participantIds.includes(member.id));

  return (
    <motion.button
      type="button"
      layout
      onClick={(event) => {
        event.stopPropagation();
        onOpen(occurrence);
      }}
      whileHover={{ y: -1 }}
      title={`${title} · ${time}`}
      style={{
        all: "unset",
        boxSizing: "border-box",
        width: "100%",
        cursor: occurrence.event ? "pointer" : "default",
        padding: detailed ? "6px 8px" : "2px 6px",
        borderRadius: token.borderRadius,
        background: palette.bg,
        borderInlineStart: `3px solid ${palette.solid}`,
        color: token.colorText,
        fontSize: detailed ? token.fontSize : token.fontSizeSM,
        overflow: "hidden",
      }}
    >
      <Flex align="center" gap={6} style={{ minWidth: 0 }}>
        {Icon && (
          <span style={{ display: "inline-flex", color: palette.solid, flexShrink: 0 }}>
            <Icon />
          </span>
        )}
        <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
      </Flex>
      {detailed && (
        <Flex align="center" justify="space-between" gap={6} style={{ marginTop: 2 }}>
          <span style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>{time}</span>
          {participants.length > 0 && (
            <Flex style={{ marginInlineEnd: 4 }}>
              {participants.slice(0, 3).map((member, index) => (
                <span key={member.id} style={{ marginInlineStart: index ? -6 : 0 }}>
                  <MemberAvatar member={member} size={18} />
                </span>
              ))}
            </Flex>
          )}
        </Flex>
      )}
    </motion.button>
  );
}
