import Holidays from "date-holidays";
import type { Locale } from "@/i18n/config";
import type { Occurrence } from "./domain";
import type { CalendarPreferences } from "./settings";

// Bundled data: no requests, API keys, account or paid service. See third-party notices.
export const holidayCatalog = new Holidays();
export const HOLIDAY_DATA_VERSION = "3.37.0";

export function holidayOccurrences(location: CalendarPreferences, from: number, to: number, locale: Locale): Occurrence[] {
  if (!location.country || !holidayCatalog.getCountries()[location.country]) return [];
  const calendar = new Holidays({ country: location.country, state: location.state || undefined, region: location.region || undefined }, { languages: [locale, "en"], types: ["public"] });
  const out: Occurrence[] = [];
  for (let year = new Date(from).getFullYear() - 1; year <= new Date(to).getFullYear(); year++) {
    for (const holiday of calendar.getHolidays(year)) {
      // Holidays are civil dates in the chosen place, never shifted by the device timezone.
      const [y, m, d] = holiday.date.slice(0, 10).split("-").map(Number);
      const start = new Date(y, m - 1, d);
      const end = new Date(start);
      const days = Math.max(1, Math.round((holiday.end.getTime() - holiday.start.getTime()) / 86_400_000));
      end.setDate(end.getDate() + days - 1);
      const exclusive = new Date(end); exclusive.setDate(exclusive.getDate() + 1);
      if (start.getTime() >= to || exclusive.getTime() <= from) continue;
      out.push({ key: `holiday:${location.country}:${location.state}:${location.region}:${holiday.date}:${holiday.rule}`, start: start.getTime(), end: end.getTime(), allDay: true,
        title: `${locale === "es" ? "Feriado" : "Holiday"}: ${holiday.name}`, color: "volcano", participantIds: [], event: null, holiday: true });
    }
  }
  return out;
}
