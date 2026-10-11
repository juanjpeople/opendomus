"use client";

import { Button, Checkbox, Collapse, Flex, Input, Select, Space, Typography, theme } from "antd";
import { useState } from "react";
import { Boxes, House, PackageOpen, Pencil, Plus, ShoppingBasket, ShoppingCart } from "lucide-react";
import { Reveal } from "@/components/motion";
import { Callout, ChoiceCards, IconTile, PanelHeader, QuantityStepper, SectionHeader, StepFlow } from "@/components/ui";
import { CONTAINER_DEFAULTS, CONTAINER_ICONS, SPACE_DEFAULTS, SPACE_ICONS } from "@/features/storage/domain";
import { useI18n } from "@/i18n";
import { createId } from "@/lib/id";
import { ReferencePrice } from "@/features/prices/components/ReferencePrice";
import type { Unit } from "@/features/inventory/domain";
import { initializeHouse } from "./service";
import { CUSTOM_NAME_MAX, HOUSE_TEMPLATES, ROOM_TEMPLATES, groupExamples, templateRows, setupItem, rowKey, type CustomPlace, type StockLevel, type SetupRow } from "./templates";
import { CalendarOptions } from "@/features/calendar/components/CalendarOptions";
import { DEFAULT_CALENDAR } from "@/features/calendar/settings";

const LEVELS = [
  { value: "spaces", icon: PackageOpen }, { value: "full", icon: ShoppingCart }, { value: "basic", icon: ShoppingBasket }, { value: "low", icon: Boxes },
] as const;
const fieldset = { border: 0, padding: 0, margin: 0 };

/** Selecting a pattern only edits a draft. One explicit confirmation writes the whole house. */
export function HouseSetup({ onComplete, onCancel, embedded = false }: { onComplete: () => void; onCancel?: () => void; embedded?: boolean }) {
  const { locale, t } = useI18n();
  const { token } = theme.useToken();
  const [groups, setGroups] = useState<string[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [customRooms, setCustomRooms] = useState<CustomPlace[]>([]);
  const [customContainers, setCustomContainers] = useState<CustomPlace[]>([]);
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  const [calendar, setCalendar] = useState(DEFAULT_CALENDAR);
  const [level, setLevel] = useState<StockLevel>("spaces");
  const [rows, setRows] = useState<SetupRow[]>([]);
  const [omitted, setOmitted] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const selectedRows = rows.filter((row) => !omitted.includes(rowKey(row)));
  const presetGroups = groups.filter((id) => HOUSE_TEMPLATES.some((group) => group.id === id));
  const roomOptions = [...ROOM_TEMPLATES.map((room) => ({ id: room.id, name: room.name[locale], kind: room.kind })), ...customRooms.map((room) => ({ ...room, kind: "other" as const }))];
  const groupOptions = [...HOUSE_TEMPLATES.map((group) => ({ id: group.id, name: group.name[locale], kind: group.kind, preset: true })), ...customContainers.map((place) => ({ ...place, kind: "other" as const, preset: false }))];
  const selectedGroups = groupOptions.filter((group) => groups.includes(group.id));

  function chooseRooms(next: string[]) {
    setRooms(next);
    setDestinations(Object.fromEntries(groups.map((id) => [id, next.includes(destinations[id]) ? destinations[id] : next[0] ?? ""])));
  }
  function chooseGroups(next: string[]) {
    setGroups(next);
    setDestinations(Object.fromEntries(next.map((id) => {
      const preferred = HOUSE_TEMPLATES.find((group) => group.id === id)?.space.id ?? "";
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
  function addRoom(name: string) {
    const room = { id: createId(), name };
    setCustomRooms([...customRooms, room]);
    chooseRooms([...rooms, room.id]);
  }
  function addContainer(name: string) {
    const place = { id: createId(), name };
    setCustomContainers([...customContainers, place]);
    chooseGroups([...groups, place.id]);
  }
  function levelDescription(value: StockLevel) {
    if (value === "spaces") return t("houseSetup.levelHelp.spaces");
    if (presetGroups.length === 0) return t("houseSetup.levelHelp.noGroups");
    const preview = templateRows(presetGroups, value);
    const examples = preview.slice(0, 3).map((row) => {
      const product = setupItem(row, locale);
      return t("houseSetup.example", { name: product.name, quantity: row.quantity, unit: t(`inventory.units.${product.unit as Unit}`, { count: row.quantity }) });
    }).join(", ");
    return t(`houseSetup.levelHelp.${value}`, { items: t("houseSetup.items", { count: preview.length }), examples });
  }
  async function finish(empty: boolean) {
    setBusy(true);
    setError(false);
    try {
      const selection = empty ? { groups: [], rows: [] } : {
        groups: presetGroups, rows: selectedRows, rooms, destinations, calendar,
        customRooms: customRooms.filter((room) => rooms.includes(room.id)),
        customContainers: customContainers.filter((place) => groups.includes(place.id)),
      };
      const applied = await initializeHouse(selection, locale);
      if (!applied) { setError(true); return; }
      onComplete();
    } catch { setError(true); }
    finally { setBusy(false); }
  }

  const steps = [t("houseSetup.steps.rooms"), t("houseSetup.steps.groups"), t("houseSetup.steps.stock"), t("houseSetup.steps.calendar")];
  const last = step === steps.length - 1;
  const missingRoom = groups.some((id) => !rooms.includes(destinations[id]));
  function go(next: number) {
    setStep(next);
    if (!embedded) window.scrollTo({ top: 0 });
  }

  return <StepFlow steps={steps} current={step} screenKey={`house-setup-${step}`} framed={!embedded}
    header={<PanelHeader icon={House} title={t("houseSetup.title")} description={t("houseSetup.description")} />}
    busy={busy}
    primary={last ? { label: t("houseSetup.save"), onClick: () => void finish(false), disabled: missingRoom }
      : { label: t("houseSetup.next"), onClick: () => go(step + 1), disabled: step === 1 && missingRoom }}
    back={step > 0 ? { label: t("houseSetup.back"), onClick: () => go(step - 1) } : onCancel ? { label: t("houseSetup.back"), onClick: onCancel } : undefined}
    secondary={{ label: t("houseSetup.empty"), onClick: () => void finish(true) }}>
    {step === 0 && <>
      <Reveal>
        <Callout tone="primary" icon={Pencil} title={t("houseSetup.flexibleTitle")}>{t("houseSetup.flexibleText")}</Callout>
      </Reveal>
      <Reveal delay={0.05}>
        <fieldset disabled={busy} style={fieldset}>
          <legend>{t("houseSetup.rooms")}</legend>
          <Typography.Paragraph type="secondary">{t("houseSetup.roomsHint")}</Typography.Paragraph>
          <ChoiceCards multiple compact aria-label={t("houseSetup.rooms")} value={rooms} disabled={busy} onChange={chooseRooms}
            options={roomOptions.map((room) => ({ value: room.id, title: room.name, description: customRooms.some((entry) => entry.id === room.id) ? t("houseSetup.yours") : undefined,
              leading: <IconTile icon={SPACE_ICONS[room.kind]} color={SPACE_DEFAULTS[room.kind].color} size={token.controlHeight} /> }))} />
          <AddPlace label={t("houseSetup.addRoom")} placeholder={t("houseSetup.addRoomPlaceholder")} taken={roomOptions.map((room) => room.name)} disabled={busy} onAdd={addRoom} />
        </fieldset>
      </Reveal>
    </>}
    {step === 1 && <Reveal delay={0.05}>
      <fieldset disabled={busy} style={fieldset}>
        <legend>{t("houseSetup.groups")}</legend>
        <Typography.Paragraph type="secondary">{t(rooms.length === 0 ? "houseSetup.chooseRoom" : "houseSetup.groupsHint")}</Typography.Paragraph>
        <ChoiceCards multiple compact aria-label={t("houseSetup.groups")} value={groups} disabled={busy} onChange={chooseGroups} options={groupOptions.map((group) => {
          const examples = groupExamples(group.id, locale);
          return {
            value: group.id, title: group.name, disabled: rooms.length === 0 && !groups.includes(group.id),
            description: group.preset ? t("houseSetup.groupExamples", { count: examples.length, examples: examples.slice(0, 3).join(", ") }) : t("houseSetup.yoursEmpty"),
            leading: <IconTile icon={CONTAINER_ICONS[group.kind]} color={CONTAINER_DEFAULTS[group.kind].color} size={token.controlHeight} />,
          };
        })} />
        <AddPlace label={t("houseSetup.addContainer")} placeholder={t("houseSetup.addContainerPlaceholder")} taken={groupOptions.map((group) => group.name)} disabled={busy || rooms.length === 0} onAdd={addContainer} />
        {selectedGroups.map((group) => <label key={group.id} style={{ display: "block", marginTop: token.marginSM }}>
          {t("houseSetup.location", { name: group.name })}
          <Select aria-label={t("houseSetup.locationLabel", { name: group.name })} style={{ width: "100%" }} value={destinations[group.id] || undefined} disabled={busy} options={roomOptions.filter((room) => rooms.includes(room.id)).map((room) => ({ value: room.id, label: room.name }))} onChange={(room) => setDestinations({ ...destinations, [group.id]: room })} />
        </label>)}
      </fieldset>
    </Reveal>}
    {step === 2 && <>
      <Reveal delay={0.05}>
        <fieldset disabled={busy} style={fieldset}>
          <legend>{t("houseSetup.stock")}</legend>
          <Typography.Paragraph type="secondary">{t("houseSetup.stockHint")}</Typography.Paragraph>
          <ChoiceCards compact layout="list" aria-label={t("houseSetup.stock")} value={level} onChange={chooseLevel} disabled={busy}
            options={LEVELS.map(({ value, icon }) => ({ value, title: t(`houseSetup.levels.${value}`), description: levelDescription(value), leading: <IconTile icon={icon} size={token.controlHeight} /> }))} />
        </fieldset>
      </Reveal>
      {level !== "spaces" && <Callout title={t("houseSetup.examplesScope")}>{t("houseSetup.examples")}</Callout>}
      {selectedGroups.length > 0 && <Reveal delay={0.1}>
        <SectionHeader title={t("houseSetup.review")} description={t("houseSetup.containers", { count: selectedGroups.length }) + " · " + t("houseSetup.items", { count: selectedRows.length })} />
        <Typography.Paragraph type="secondary">{t("houseSetup.reviewHint")}</Typography.Paragraph>
        <Collapse items={selectedGroups.map((group) => {
          const groupRows = rows.filter((row) => row.groupId === group.id);
          const kept = groupRows.filter((row) => !omitted.includes(rowKey(row)));
          const names = kept.slice(0, 3).map((row) => setupItem(row, locale).name).join(", ");
          return {
            key: group.id,
            label: <Flex vertical>
              <Typography.Text strong>{group.name}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{kept.length ? t("houseSetup.groupPreview", { count: kept.length, examples: names }) : t("houseSetup.emptyContainer")}</Typography.Text>
            </Flex>,
            children: <Flex vertical gap={token.margin}>
              {groupRows.length === 0 && <Typography.Text>{t("houseSetup.emptyContainer")}</Typography.Text>}
              {groupRows.map((row) => {
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
          };
        })} />
      </Reveal>}
    </>}
    {last && <>
      <Reveal delay={0.05}>
        <SectionHeader title={t("houseSetup.calendar")} />
        <CalendarOptions value={calendar} onChange={setCalendar} disabled={busy} />
      </Reveal>
      <Typography.Text type="secondary">{t("houseSetup.atomic")}</Typography.Text>
    </>}
    {error && <Callout tone="danger" role="alert" title={t("houseSetup.errorTitle")}>{t("houseSetup.errorText")}</Callout>}
  </StepFlow>;
}

/** Names a new room or container. It joins the list already selected; repeated names are refused. */
function AddPlace({ label, placeholder, taken, disabled, onAdd }: { label: string; placeholder: string; taken: string[]; disabled?: boolean; onAdd: (name: string) => void }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const repeated = taken.some((entry) => entry.localeCompare(trimmed, undefined, { sensitivity: "base" }) === 0);
  function add() {
    if (!trimmed || repeated) return;
    onAdd(trimmed);
    setName("");
  }
  return <div style={{ marginTop: token.marginSM }}>
    <Space.Compact style={{ width: "100%" }}>
      <Input aria-label={label} placeholder={placeholder} value={name} maxLength={CUSTOM_NAME_MAX} disabled={disabled} status={repeated ? "warning" : undefined}
        onChange={(event) => setName(event.target.value)} onPressEnter={(event) => { event.preventDefault(); add(); }} />
      <Button icon={<Plus />} disabled={disabled || !trimmed || repeated} onClick={add}>{t("houseSetup.add")}</Button>
    </Space.Compact>
    {repeated && <Typography.Text type="warning" style={{ fontSize: token.fontSizeSM }}>{t("houseSetup.repeated")}</Typography.Text>}
  </div>;
}
