"use client";

import { Button, Flex, Grid, Segmented, Tooltip, Typography, theme } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Can } from "@/components/auth/Can";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { PageHeader, LoadingSkeleton } from "@/components/ui";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { useElementWidth } from "@/hooks/useElementWidth";
import { useMembers } from "@/features/members/hooks";
import { useI18n } from "@/i18n";
import { APPEARANCE_ICONS, tint } from "@/lib/appearance";
import { usePermission } from "@/lib/auth/hooks";
import { DURATION, EASE_OUT } from "@/lib/motion";
import type { CalendarEvent, Occurrence } from "../domain";
import { useOccurrences } from "../hooks";
import { EventModal } from "./EventModal";
import { CalendarSettingsPanel } from "./CalendarOptions";

type View = "week" | "month";

/** Ancho mínimo del área para mostrar la semana en 7 columnas (si no, una fila por día). */
const WEEK_COLUMNS_MIN = 840;
/** Por debajo de esto, el mes usa iniciales para los días ("L M M J V S D"). */
const MONTH_COMPACT_MAX = 560;

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
  // Se mide el área real (no la pantalla): con el menú abierto, el contenido es más angosto.
  const [areaRef, areaWidth] = useElementWidth<HTMLDivElement>();
  const columns = (areaWidth ?? 0) >= WEEK_COLUMNS_MIN;

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

      <CalendarSettingsPanel />
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

      <div ref={areaRef}>
      {!occurrences || areaWidth === null ? (
        <LoadingSkeleton />
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
              <WeekView days={days} occurrences={visible} stacked={!columns} onOpen={openOccurrence} onAdd={canManage ? addOn : undefined} />
            ) : (
              <MonthView
                days={days}
                month={cursor.month()}
                occurrences={visible}
                compact={areaWidth < MONTH_COMPACT_MAX}
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

      </div>

      <EventModal open={!!modal} event={modal?.event} day={modal?.day} onClose={() => setModal(null)} />
    </RequirePermission>
  );
}

/** Día de la semana y número. En columnas, uno arriba del otro (nunca se parte la palabra). */
function DayHeader({ day, vertical = false }: { day: Dayjs; vertical?: boolean }) {
  const { token } = theme.useToken();
  const { format } = useI18n();
  const today = day.isSame(dayjs(), "day");
  return (
    <Flex vertical={vertical} align={vertical ? "flex-start" : "center"} gap={vertical ? 2 : 8} style={{ minWidth: 0 }}>
      <Typography.Text
        type="secondary"
        style={{ textTransform: "uppercase", fontSize: token.fontSizeSM, letterSpacing: "0.06em", whiteSpace: "nowrap", lineHeight: 1.2 }}
      >
        {format.date(day.valueOf(), { weekday: "short" }).replace(".", "")}
      </Typography.Text>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 30,
          height: 30,
          paddingInline: 4,
          borderRadius: 15,
          fontWeight: 600,
          fontSize: vertical ? token.fontSizeLG : token.fontSize,
          background: today ? token.colorPrimary : "transparent",
          color: today ? token.colorTextLightSolid : token.colorText,
          marginInlineStart: vertical ? -4 : 0,
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
    <div style={{ display: "grid", gridTemplateColumns: stacked ? "1fr" : "repeat(7, minmax(0, 1fr))", gap: stacked ? 8 : 10 }}>
      {days.map((day) => {
        const items = occurrences.filter((occurrence) => onDay(occurrence, day));
        const today = day.isSame(dayjs(), "day");
        return (
          <div
            key={day.valueOf()}
            style={{
              minHeight: stacked ? undefined : 360,
              padding: stacked ? "10px 12px" : 10,
              borderRadius: token.borderRadiusLG,
              border: `1px solid ${today ? token.colorPrimaryBorder : token.colorBorderSecondary}`,
              background: today ? token.colorPrimaryBg : token.colorBgContainer,
              // En fila: el día a la izquierda y sus eventos a la derecha (se lee como una agenda).
              display: stacked ? "grid" : "flex",
              gridTemplateColumns: stacked ? "88px minmax(0, 1fr) auto" : undefined,
              alignItems: stacked ? "center" : undefined,
              flexDirection: "column",
              gap: stacked ? 12 : 8,
            }}
          >
            {stacked ? (
              <>
                <DayHeader day={day} />
                <Flex vertical gap={6} style={{ minWidth: 0 }}>
                  {items.length === 0 && (
                    <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                      {t("calendar.empty")}
                    </Typography.Text>
                  )}
                  {items.map((occurrence) => (
                    <EventChip key={occurrence.key} occurrence={occurrence} onOpen={onOpen} detailed />
                  ))}
                </Flex>
                {onAdd ? <Button type="text" icon={<Plus />} aria-label={t("calendar.newEvent")} onClick={() => onAdd(day)} style={{ width: 40, height: 40 }} /> : <span />}
              </>
            ) : (
              <>
                <Flex justify="space-between" align="flex-start" gap={4}>
                  <DayHeader day={day} vertical />
                  {onAdd && <Button type="text" size="small" icon={<Plus />} aria-label={t("calendar.newEvent")} onClick={() => onAdd(day)} />}
                </Flex>
                {items.map((occurrence) => (
                  <EventChip key={occurrence.key} occurrence={occurrence} onOpen={onOpen} detailed />
                ))}
              </>
            )}
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
  compact,
  onOpen,
  onAdd,
  onShowDay,
}: {
  days: Dayjs[];
  month: number;
  occurrences: Occurrence[];
  compact: boolean;
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
          <Typography.Text
            key={day.valueOf()}
            type="secondary"
            style={{ padding: compact ? "8px 0" : "8px 10px", textAlign: compact ? "center" : undefined, textTransform: "uppercase", fontSize: token.fontSizeSM, letterSpacing: "0.06em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {format.date(day.valueOf(), { weekday: compact ? "narrow" : "short" }).replace(".", "")}
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
                minHeight: compact ? 72 : 112,
                padding: compact ? 3 : 6,
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
              {compact ? (
                // Sin lugar para títulos: un punto por evento; tocar el día abre su semana.
                items.length > 0 && (
                  <button
                    type="button"
                    aria-label={t("calendar.more", { count: items.length })}
                    onClick={() => onShowDay(day)}
                    style={{ all: "unset", cursor: "pointer", display: "flex", flexWrap: "wrap", gap: 3, padding: "2px 3px" }}
                  >
                    {items.slice(0, 6).map((occurrence) => (
                      <span key={occurrence.key} style={{ width: 7, height: 7, borderRadius: "50%", background: tint(token, occurrence.color).solid }} />
                    ))}
                  </button>
                )
              ) : (
                items.slice(0, MAX).map((occurrence) => <EventChip key={occurrence.key} occurrence={occurrence} onOpen={onOpen} />)
              )}
              {!compact && items.length > MAX && (
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
          <span style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{time}</span>
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
