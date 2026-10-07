"use client";

import { Alert, App, Button, Card, Checkbox, Flex, Select, Typography } from "antd";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useI18n } from "@/i18n";
import { db } from "@/lib/db";
import { useCurrentUser } from "@/lib/auth/session";
import { usePermission } from "@/lib/auth/hooks";
import { getErrorMessage } from "@/lib/errors";
import { holidayCatalog, HOLIDAY_DATA_VERSION } from "../holidays";
import { DEFAULT_CALENDAR, type CalendarPreferences } from "../settings";
import { saveCalendarPreferences } from "../service";

export function CalendarOptions({ value, onChange, disabled }: { value: CalendarPreferences; onChange: (value: CalendarPreferences) => void; disabled?: boolean }) {
  const { locale } = useI18n();
  const es = locale === "es";
  const countries = holidayCatalog.getCountries(locale);
  const states = value.country ? holidayCatalog.getStates(value.country, locale) ?? {} : {};
  const regions = value.country && value.state ? holidayCatalog.getRegions(value.country, value.state, locale) ?? {} : {};
  const options = (entries: Record<string, string>) => Object.entries(entries).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, locale));
  return <Flex vertical gap={12}>
    <Checkbox checked={value.schoolEnabled} disabled={disabled} onChange={(event) => onChange({ ...value, schoolEnabled: event.target.checked })}>{es ? "Activar escuela: materias, mochila y tareas" : "Enable school: subjects, backpack and homework"}</Checkbox>
    <label>{es ? "País para los feriados" : "Country for holidays"}
      <Select aria-label={es ? "País para los feriados" : "Country for holidays"} style={{ width: "100%" }} showSearch optionFilterProp="label" allowClear disabled={disabled} placeholder={es ? "Sin feriados automáticos" : "No automatic holidays"} value={value.country || undefined} options={options(countries)} onChange={(country) => onChange({ ...value, country: country ?? "", state: "", region: "" })} />
    </label>
    {Object.keys(states).length > 0 && <label>{es ? "Provincia o estado" : "State or province"}
      <Select aria-label={es ? "Provincia o estado" : "State or province"} style={{ width: "100%" }} showSearch optionFilterProp="label" allowClear disabled={disabled} placeholder={es ? "Solo nacionales" : "National only"} value={value.state || undefined} options={options(states)} onChange={(state) => onChange({ ...value, state: state ?? "", region: "" })} />
    </label>}
    {Object.keys(regions).length > 0 && <label>{es ? "Región o localidad" : "Region or town"}
      <Select aria-label={es ? "Región o localidad" : "Region or town"} style={{ width: "100%" }} showSearch optionFilterProp="label" allowClear disabled={disabled} value={value.region || undefined} options={options(regions)} onChange={(region) => onChange({ ...value, region: region ?? "" })} />
    </label>}
    {value.country && Object.keys(states).length === 0 && <Typography.Text type="secondary">{es ? `Para ${countries[value.country] ?? value.country}, este catálogo solo incluye cobertura nacional. Las fechas provinciales y locales se agregan manualmente.` : `For ${countries[value.country] ?? value.country}, this catalog only covers national dates. Add state and local dates manually.`}</Typography.Text>}
    <Typography.Paragraph type="secondary" style={{ margin: 0 }}>{es
      ? "Catálogo incluido en la app, sin API key ni tarjeta. Solo ofrece las regiones disponibles; no cubre todas las fechas locales o escolares. Agregá las faltantes como eventos de tipo Feriado o Sin clases. Las materias no se cancelan automáticamente por un feriado: confirmá con la escuela y agregá un período sin clases."
      : "Included in the app, with no API key or card. Coverage varies by region and does not include every local or school date. Add missing dates as Holiday or No school events. Holidays do not automatically cancel lessons: check with the school and add a No school period."}</Typography.Paragraph>
    <Typography.Link href="/third-party-notices.txt" target="_blank">date-holidays {HOLIDAY_DATA_VERSION} · {es ? "Fuente y licencias" : "Source and licenses"}</Typography.Link>
  </Flex>;
}

export function CalendarSettingsPanel() {
  const saved = useLiveQuery(() => db.houseSettings.get("calendar"));
  const [draft, setDraft] = useState<CalendarPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const canManage = usePermission("calendar.manage");
  const actor = useCurrentUser();
  const { locale, t } = useI18n();
  const { message } = App.useApp();
  const es = locale === "es";
  if (!canManage) return null;
  async function save() {
    setBusy(true);
    try { await saveCalendarPreferences(actor, draft ?? saved ?? DEFAULT_CALENDAR); setDraft(null); message.success(es ? "Calendario configurado" : "Calendar configured"); }
    catch (error) { message.error(getErrorMessage(error, t)); }
    finally { setBusy(false); }
  }
  return <Card style={{ marginBottom: 20 }}><details>
    <summary style={{ cursor: "pointer" }}>{es ? "Configurar feriados y escuela" : "Configure holidays and school"}</summary>
    <Flex vertical gap={16} style={{ marginTop: 16 }}>
      <CalendarOptions value={draft ?? saved ?? DEFAULT_CALENDAR} onChange={setDraft} disabled={busy} />
      <Alert type="info" title={es ? "Cada casa elige su ubicación. Para el ciclo lectivo, elegí la primera clase y el fin de repetición al cargar cada materia." : "Each home chooses its location. For a school term, choose the first lesson and the repeat end date for each subject."} />
      <Button type="primary" loading={busy} disabled={!draft} onClick={() => void save()}>{es ? "Guardar configuración" : "Save settings"}</Button>
    </Flex>
  </details></Card>;
}
