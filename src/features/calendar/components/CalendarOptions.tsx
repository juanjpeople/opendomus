"use client";

import { App, Button, Card, Checkbox, Flex, Select, Typography, theme } from "antd";
import { useId, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Callout } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { useI18n } from "@/i18n";
import { db } from "@/lib/db";
import { useCurrentUser } from "@/lib/auth/session";
import { usePermission } from "@/lib/auth/hooks";
import { getErrorMessage } from "@/lib/errors";
import { holidayCatalog, HOLIDAY_DATA_VERSION } from "../holidays";
import { DEFAULT_CALENDAR, type CalendarPreferences } from "../settings";
import { saveCalendarPreferences } from "../service";

export function CalendarOptions({ value, onChange, disabled }: { value: CalendarPreferences; onChange: (value: CalendarPreferences) => void; disabled?: boolean }) {
  const { locale, t } = useI18n();
  const { token } = theme.useToken();
  const countries = holidayCatalog.getCountries(locale);
  const states = value.country ? holidayCatalog.getStates(value.country, locale) ?? {} : {};
  const regions = value.country && value.state ? holidayCatalog.getRegions(value.country, value.state, locale) ?? {} : {};
  const id = useId();
  const options = (entries: Record<string, string>) => Object.entries(entries).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, locale));
  return <Flex vertical gap={token.marginSM}>
    <div>
      <Checkbox checked={value.schoolEnabled} disabled={disabled} aria-describedby={`${id}-school`} onChange={(event) => onChange({ ...value, schoolEnabled: event.target.checked })}>{t("school.enable")}</Checkbox>
      <Typography.Paragraph id={`${id}-school`} type="secondary" style={{ margin: `${token.marginXXS}px 0 0`, paddingInlineStart: token.paddingLG }}>{t("school.enableHelp")}</Typography.Paragraph>
    </div>
    <label>{t("school.country")}
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>{t("school.countryHelp")}</Typography.Paragraph>
      <Select aria-label={t("school.country")} style={{ width: "100%" }} showSearch optionFilterProp="label" allowClear disabled={disabled} placeholder={t("school.noHolidays")} value={value.country || undefined} options={options(countries)} onChange={(country) => onChange({ ...value, country: country ?? "", state: "", region: "" })} />
    </label>
    {Object.keys(states).length > 0 && <label>{t("school.state")}
      <Select aria-label={t("school.state")} style={{ width: "100%" }} showSearch optionFilterProp="label" allowClear disabled={disabled} placeholder={t("school.nationalOnly")} value={value.state || undefined} options={options(states)} onChange={(state) => onChange({ ...value, state: state ?? "", region: "" })} />
    </label>}
    {Object.keys(regions).length > 0 && <label>{t("school.region")}
      <Select aria-label={t("school.region")} style={{ width: "100%" }} showSearch optionFilterProp="label" allowClear disabled={disabled} value={value.region || undefined} options={options(regions)} onChange={(region) => onChange({ ...value, region: region ?? "" })} />
    </label>}
    {value.country && Object.keys(states).length === 0 && <Typography.Text type="secondary">{t("school.nationalCoverage", { country: countries[value.country] ?? value.country })}</Typography.Text>}
    <Typography.Paragraph type="secondary" style={{ margin: 0 }}>{t("school.coverage")}</Typography.Paragraph>
    <Typography.Link href="/third-party-notices.txt" target="_blank">date-holidays {HOLIDAY_DATA_VERSION} · {t("school.source")}</Typography.Link>
  </Flex>;
}

export function CalendarSettingsPanel() {
  const saved = useLiveQuery(() => db.houseSettings.get("calendar"));
  const [draft, setDraft] = useState<CalendarPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const { token } = theme.useToken();
  const canManage = usePermission("calendar.manage");
  const actor = useCurrentUser();
  const { t } = useI18n();
  const { message } = App.useApp();
  if (!canManage) return null;
  async function save() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try { await saveCalendarPreferences(actor, draft ?? saved ?? DEFAULT_CALENDAR); setDraft(null); message.success(t("school.saved")); }
    catch (error) { message.error(getErrorMessage(error, t)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Reveal><Card style={{ marginBottom: token.marginLG }}><details>
    <summary style={{ cursor: "pointer", minHeight: 44, alignContent: "center" }}>{t("school.configure")}</summary>
    <Flex vertical gap={token.margin} style={{ marginTop: token.margin }}>
      <CalendarOptions value={draft ?? saved ?? DEFAULT_CALENDAR} onChange={setDraft} disabled={busy} />
      <Callout>{t("school.termHelp")}</Callout>
      <Button type="primary" loading={busy} disabled={!draft || busy} aria-label={t("school.save")} onClick={() => void save()}>{t("school.save")}</Button>
    </Flex>
  </details></Card></Reveal>;
}
