/**
 * Calendario compartido: eventos de la casa, con repetición y participantes.
 * Los cumpleaños no se cargan: salen de la fecha de nacimiento de cada miembro.
 */
import { isAppearanceColor, isAppearanceIcon, type AppearanceColor, type AppearanceIcon } from "@/lib/appearance";
import { ValidationError } from "@/lib/errors";
import { isPrivacy, type Privacy } from "@/lib/sync/scope";

export const REPEATS = ["none", "daily", "weekly", "monthly", "yearly"] as const;
export type Repeat = (typeof REPEATS)[number];
export const EVENT_KINDS = ["event", "class", "homework", "break", "holiday"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export interface CalendarEvent {
  id: string;
  title: string;
  /** Quién lo ve con la casa en la nube (por defecto, Familia). */
  privacy?: Privacy;
  /** Inicio (ms). En eventos de todo el día, la medianoche local del primer día. */
  start: number;
  /** Fin (ms). En eventos de todo el día, la medianoche del último día. */
  end: number;
  allDay: boolean;
  repeat: Repeat;
  repeatUntil?: number;
  eventKind?: EventKind;
  homeworkDone?: boolean;
  /** Miembros que participan (vacío = toda la casa). */
  participantIds: string[];
  color: AppearanceColor;
  icon?: AppearanceIcon;
  notes?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export type EventInput = Pick<CalendarEvent, "title" | "start" | "end" | "allDay" | "repeat" | "repeatUntil" | "eventKind" | "homeworkDone" | "participantIds" | "color" | "icon" | "notes"> & { privacy?: Privacy };

export const EVENT_LIMITS = { titleMaxLength: 80, notesMaxLength: 1000 } as const;

export function parseEvent(input: EventInput): EventInput & { privacy: Privacy } {
  const title = input.title?.trim() ?? "";
  const privacy = input.privacy ?? "family";
  if (!title) throw new ValidationError("errors.validation.nameRequired");
  if (title.length > EVENT_LIMITS.titleMaxLength) throw new ValidationError("errors.validation.nameTooLong", { max: EVENT_LIMITS.titleMaxLength });
  if (!isPrivacy(privacy)) throw new ValidationError("errors.validation.kindInvalid");
  if (!Number.isFinite(input.start) || !Number.isFinite(input.end) || input.end < input.start) throw new ValidationError("errors.validation.dateInvalid");
  if (!REPEATS.includes(input.repeat)) throw new ValidationError("errors.validation.kindInvalid");
  if (input.eventKind !== undefined && !EVENT_KINDS.includes(input.eventKind)) throw new ValidationError("errors.validation.kindInvalid");
  if (input.repeatUntil !== undefined && (!Number.isFinite(input.repeatUntil) || input.repeatUntil < input.start)) throw new ValidationError("errors.validation.dateInvalid");
  if (input.eventKind === "class" && (input.repeat !== "weekly" || input.repeatUntil === undefined || !input.participantIds?.length)) throw new ValidationError("errors.validation.dateInvalid");
  if (!isAppearanceColor(input.color) || (input.icon !== undefined && !isAppearanceIcon(input.icon))) {
    throw new ValidationError("errors.validation.appearanceInvalid");
  }
  const notes = input.notes?.trim() || undefined;
  if (notes && notes.length > EVENT_LIMITS.notesMaxLength) throw new ValidationError("errors.validation.nameTooLong", { max: EVENT_LIMITS.notesMaxLength });
  return {
    title,
    privacy,
    start: input.start,
    end: input.end,
    allDay: !!input.allDay,
    repeat: input.repeat,
    ...(input.repeatUntil !== undefined ? { repeatUntil: input.repeatUntil } : {}),
    ...(input.eventKind !== undefined ? { eventKind: input.eventKind } : {}),
    ...(input.homeworkDone !== undefined ? { homeworkDone: !!input.homeworkDone } : {}),
    participantIds: [...new Set(input.participantIds ?? [])],
    color: input.color,
    icon: input.icon,
    notes,
  };
}

// --- Ocurrencias -------------------------------------------------------------------

export interface Occurrence {
  /** Clave única para la lista (evento + inicio). */
  key: string;
  start: number;
  end: number;
  allDay: boolean;
  title: string;
  color: AppearanceColor;
  icon?: AppearanceIcon;
  participantIds: string[];
  /** Editable event, or null for derived birthdays and bundled holidays. */
  event: CalendarEvent | null;
  birthdayOf?: string;
  holiday?: boolean;
}

/** Suma `n` repeticiones respetando el calendario (31/1 + 1 mes = último día de febrero). */
function addRepeat(time: number, repeat: Repeat, n: number): number {
  const date = new Date(time);
  if (repeat === "daily") date.setDate(date.getDate() + n);
  else if (repeat === "weekly") date.setDate(date.getDate() + 7 * n);
  else if (repeat === "monthly" || repeat === "yearly") {
    const day = date.getDate();
    date.setDate(1);
    if (repeat === "monthly") date.setMonth(date.getMonth() + n);
    else date.setFullYear(date.getFullYear() + n);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));
  }
  return date.getTime();
}

const MAX_OCCURRENCES = 1000;

/** Ocurrencias de los eventos que tocan el rango [from, to). */
export function expandEvents(events: CalendarEvent[], from: number, to: number): Occurrence[] {
  const out: Occurrence[] = [];
  for (const event of events) {
    const duration = event.end - event.start;
    if (event.repeat === "none") {
      if (event.start < to && event.end + (event.allDay ? 86_400_000 : 0) > from) out.push(toOccurrence(event, event.start, duration));
      continue;
    }
    for (let n = 0; n < MAX_OCCURRENCES; n++) {
      const start = addRepeat(event.start, event.repeat, n);
      if (start >= to || (event.repeatUntil !== undefined && start > event.repeatUntil)) break;
      if (start + duration + (event.allDay ? 86_400_000 : 0) > from) out.push(toOccurrence(event, start, duration));
    }
  }
  return out;
}

/** School closures apply only to the matching pupils, or to everyone if none are specified. */
export function applySchoolBreaks(occurrences: Occurrence[]): Occurrence[] {
  const breaks = occurrences.filter((entry) => entry.event?.eventKind === "break");
  return occurrences.flatMap((entry) => {
    if (entry.event?.eventKind !== "class") return [entry];
    const participantIds = entry.participantIds.filter((id) => !breaks.some((closure) => {
      const end = new Date(closure.end);
      if (closure.allDay) end.setDate(end.getDate() + 1);
      return closure.start <= entry.start && end.getTime() > entry.start && (!closure.participantIds.length || closure.participantIds.includes(id));
    }));
    return participantIds.length ? [{ ...entry, participantIds }] : [];
  });
}

function toOccurrence(event: CalendarEvent, start: number, duration: number): Occurrence {
  return {
    key: `${event.id}:${start}`,
    start,
    end: start + duration,
    allDay: event.allDay,
    title: event.title,
    color: event.color,
    icon: event.icon,
    participantIds: event.participantIds,
    event,
  };
}

/** Cumpleaños de los miembros que caen en el rango. */
export function birthdayOccurrences(members: { id: string; name: string; color: AppearanceColor; birthday?: string }[], from: number, to: number): Occurrence[] {
  const out: Occurrence[] = [];
  const firstYear = new Date(from).getFullYear();
  const lastYear = new Date(to).getFullYear();
  for (const member of members) {
    const match = member.birthday?.match(/-(\d{2})-(\d{2})$/);
    if (!match) continue;
    const [month, day] = [Number(match[1]) - 1, Number(match[2])];
    for (let year = firstYear; year <= lastYear; year++) {
      const start = new Date(year, month, day).getTime();
      if (start >= from && start < to) {
        out.push({ key: `birthday:${member.id}:${year}`, start, end: start, allDay: true, title: member.name, color: member.color, icon: "cake", participantIds: [member.id], event: null, birthdayOf: member.id });
      }
    }
  }
  return out;
}

/** Orden dentro de un día: primero los de todo el día, después por hora. */
export function compareOccurrences(a: Occurrence, b: Occurrence): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.start - b.start || a.title.localeCompare(b.title);
}
