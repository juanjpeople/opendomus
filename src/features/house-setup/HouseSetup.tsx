"use client";

import { Checkbox, Collapse, Flex, Select, Typography, theme } from "antd";
import { useState } from "react";
import { Boxes, House, PackageOpen, ShoppingBasket, ShoppingCart } from "lucide-react";
import { Reveal } from "@/components/motion";
import { Callout, ChoiceCards, IconTile, PanelHeader, QuantityStepper, SectionHeader, StepFlow } from "@/components/ui";
import { CONTAINER_DEFAULTS, CONTAINER_ICONS, SPACE_DEFAULTS, SPACE_ICONS } from "@/features/storage/domain";
import { useI18n } from "@/i18n";
import { ReferencePrice } from "@/features/prices/components/ReferencePrice";
import type { Unit } from "@/features/inventory/domain";
import { initializeHouse } from "./service";
import { HOUSE_TEMPLATES, ROOM_TEMPLATES, templateRows, setupItem, rowKey, type StockLevel, type SetupRow } from "./templates";
import { CalendarOptions } from "@/features/calendar/components/CalendarOptions";
import { DEFAULT_CALENDAR } from "@/features/calendar/settings";

/** Selecting a pattern only edits a draft. One explicit confirmation writes the whole house. */
export function HouseSetup({ onComplete, onCancel, embedded = false }: { onComplete: () => void; onCancel?: () => void; embedded?: boolean }) {
  const { locale, t } = useI18n();
  const { token } = theme.useToken();
  const [groups, setGroups] = useState<string[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  const [calendar, setCalendar] = useState(DEFAULT_CALENDAR);
  const [level, setLevel] = useState<StockLevel>("spaces");
  const [rows, setRows] = useState<SetupRow[]>([]);
  const [omitted, setOmitted] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const selectedRows = rows.filter((row) => !omitted.includes(rowKey(row)));

  function chooseGroups(next: string[]) {
    setGroups(next);
    setDestinations(Object.fromEntries(next.map((id) => {
      const preferred = HOUSE_TEMPLATES.find((group) => group.id === id)!.space.id;
      return [id, destinations[id] ?? (rooms.includes(preferred) ? preferred : rooms[0] ?? "")];
    })));
    // Keep quantity edits in groups that remain selected.
    setRows([...rows.filter((row) => next.includes(row.groupId)), ...templateRows(next.filter((id) => !groups.includes(id)), level)]);
    setOmitted(omitted.filter((key) => next.some((id) => key.startsWith(`${id}/`))));
  }
  function chooseLevel(next: StockLevel) {
    setLevel(next);
    setRows(templateRows(groups, next));
    setOmitted([]);
  }
  async function finish(empty: boolean) {
    setBusy(true);
    setError(false);
    try {
      const applied = await initializeHouse(empty ? { groups: [], rows: [] } : { groups, rows: selectedRows, rooms, destinations, calendar }, locale);
      if (!applied) { setError(true); return; }
      onComplete();
    } catch { setError(true); }
    finally { setBusy(false); }
  }

  return <StepFlow screenKey="house-setup" framed={!embedded}
    header={<PanelHeader icon={House} title={t("houseSetup.title")} description={t("houseSetup.description")} />}
    busy={busy}
    primary={{ label: t("houseSetup.save"), onClick: () => void finish(false), disabled: groups.some((id) => !rooms.includes(destinations[id])) }}
    back={onCancel ? { label: t("houseSetup.back"), onClick: onCancel } : undefined}
    secondary={{ label: t("houseSetup.empty"), onClick: () => void finish(true) }}>
    <Reveal delay={0.05}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend>{t("houseSetup.rooms")}</legend>
        <ChoiceCards multiple compact aria-label={t("houseSetup.rooms")} value={rooms} disabled={busy} onChange={(next) => {
          setRooms(next);
          setDestinations(Object.fromEntries(groups.map((id) => [id, next.includes(destinations[id]) ? destinations[id] : next[0] ?? ""])));
        }} options={ROOM_TEMPLATES.map((room) => ({ value: room.id, title: room.name[locale], leading: <IconTile icon={SPACE_ICONS[room.kind]} color={SPACE_DEFAULTS[room.kind].color} size={token.controlHeight} /> }))} />
      </fieldset>
    </Reveal>
    <Reveal delay={0.1}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend>{t("houseSetup.groups")}</legend>
        {rooms.length === 0 && <Typography.Paragraph type="secondary">{t("houseSetup.chooseRoom")}</Typography.Paragraph>}
        <ChoiceCards multiple compact aria-label={t("houseSetup.groups")} value={groups} disabled={busy} onChange={chooseGroups} options={HOUSE_TEMPLATES.map((group) => ({
          value: group.id, title: group.name[locale], disabled: rooms.length === 0 && !groups.includes(group.id),
          leading: <IconTile icon={CONTAINER_ICONS[group.kind]} color={CONTAINER_DEFAULTS[group.kind].color} size={token.controlHeight} />,
        }))} />
        {HOUSE_TEMPLATES.filter((group) => groups.includes(group.id)).map((group) => <label key={group.id} style={{ display: "block", marginTop: token.marginSM }}>
          {t("houseSetup.location", { name: group.name[locale] })}
          <Select aria-label={t("houseSetup.locationLabel", { name: group.name[locale] })} style={{ width: "100%" }} value={destinations[group.id] || undefined} disabled={busy} options={ROOM_TEMPLATES.filter((room) => rooms.includes(room.id)).map((room) => ({ value: room.id, label: room.name[locale] }))} onChange={(room) => setDestinations({ ...destinations, [group.id]: room })} />
        </label>)}
      </fieldset>
    </Reveal>
    <Reveal delay={0.15}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend>{t("houseSetup.stock")}</legend>
        <ChoiceCards compact layout="list" aria-label={t("houseSetup.stock")} value={level} onChange={chooseLevel} disabled={busy} options={([
          { value: "spaces", icon: PackageOpen }, { value: "full", icon: ShoppingCart }, { value: "basic", icon: ShoppingBasket }, { value: "low", icon: Boxes },
        ] as const).map(({ value, icon }) => ({ value, title: t(`houseSetup.levels.${value}`), leading: <IconTile icon={icon} size={token.controlHeight} /> }))} />
      </fieldset>
    </Reveal>
    <Callout title={t("houseSetup.examplesScope")}>{t("houseSetup.examples")}</Callout>
    {groups.length > 0 && <Reveal delay={0.2}>
      <SectionHeader title={t("houseSetup.review")} description={t("houseSetup.containers", { count: groups.length }) + " · " + t("houseSetup.items", { count: selectedRows.length })} />
      <Typography.Paragraph type="secondary">{t("houseSetup.reviewHint")}</Typography.Paragraph>
      <Collapse items={HOUSE_TEMPLATES.filter((group) => groups.includes(group.id)).map((group) => ({
        key: group.id, label: group.name[locale],
        children: <Flex vertical gap={token.margin}>
          {rows.filter((row) => row.groupId === group.id).length === 0 && <Typography.Text>{t("houseSetup.emptyContainer")}</Typography.Text>}
          {rows.filter((row) => row.groupId === group.id).map((row) => {
            const product = setupItem(row, locale);
            const key = rowKey(row);
            return <div key={key}>
              <Flex align="center" gap={token.marginXS} wrap>
                <Checkbox checked={!omitted.includes(key)} disabled={busy} onChange={(event) => setOmitted(event.target.checked ? omitted.filter((entry) => entry !== key) : [...omitted, key])}>{product.name}</Checkbox>
                <QuantityStepper aria-label={t("houseSetup.quantity", { name: product.name })} min={0} max={100000} precision={0} value={row.quantity} disabled={busy || omitted.includes(key)} onChange={(value) => setRows(rows.map((entry) => rowKey(entry) === key ? { ...entry, quantity: value } : entry))} />
                <Typography.Text>{t(`inventory.units.${product.unit as Unit}`, { count: row.quantity })}</Typography.Text>
              </Flex>
              <div style={{ marginTop: token.marginXS }}><ReferencePrice catalogId={row.catalogId} /></div>
            </div>;
          })}
        </Flex>,
      }))} />
    </Reveal>}
    <Reveal delay={0.25}>
      <SectionHeader title={t("houseSetup.calendar")} />
      <CalendarOptions value={calendar} onChange={setCalendar} disabled={busy} />
    </Reveal>
    <Typography.Text type="secondary">{t("houseSetup.atomic")}</Typography.Text>
    {error && <Callout tone="danger" role="alert" title={t("houseSetup.errorTitle")}>{t("houseSetup.errorText")}</Callout>}
  </StepFlow>;
}
