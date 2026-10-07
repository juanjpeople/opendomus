export interface CalendarSettings {
  id: "calendar";
  country: string;
  state: string;
  region: string;
  schoolEnabled: boolean;
  updatedAt: number;
}
export type CalendarPreferences = Omit<CalendarSettings, "id" | "updatedAt">;
export const DEFAULT_CALENDAR: CalendarPreferences = { country: "", state: "", region: "", schoolEnabled: false };

export function parseCalendarPreferences(value: CalendarPreferences): CalendarPreferences {
  if (typeof value.schoolEnabled !== "boolean" || [value.country, value.state, value.region].some((code) => typeof code !== "string" || !/^[A-Za-z0-9_-]{0,20}$/.test(code)) || (!value.country && (value.state || value.region)) || (!value.state && value.region)) throw new Error("Invalid calendar preferences");
  return { country: value.country, state: value.state, region: value.region, schoolEnabled: value.schoolEnabled };
}
