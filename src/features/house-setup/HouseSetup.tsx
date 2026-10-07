"use client";

import { Alert, Button, Checkbox, Collapse, Flex, InputNumber, Radio, Select, Typography } from "antd";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { ReferencePrice } from "@/features/prices/components/ReferencePrice";
import type { Unit } from "@/features/inventory/domain";
import { initializeHouse } from "./service";
import { HOUSE_TEMPLATES, ROOM_TEMPLATES, templateRows, setupItem, rowKey, type StockLevel, type SetupRow } from "./templates";
import { CalendarOptions } from "@/features/calendar/components/CalendarOptions";
import { DEFAULT_CALENDAR } from "@/features/calendar/settings";

/** Selecting a pattern only edits a draft. One explicit confirmation writes the whole house. */
export function HouseSetup({ onComplete, onCancel }: { onComplete: () => void; onCancel?: () => void }) {
  const { locale, t } = useI18n();
  const es = locale === "es";
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

  return <Flex vertical gap={20} style={{ maxWidth: 760, margin: "0 auto" }}>
    <div>
      <Typography.Title level={2}>{es ? "¿Cómo querés empezar tu casa?" : "How would you like to start your home?"}</Typography.Title>
      <Typography.Paragraph>{es
        ? "Podés empezar vacía o elegir espacios y artículos de ejemplo. Revisá las cantidades para que coincidan con lo que tenés. Después podés cambiar todo."
        : "Start empty or choose example spaces and items. Review quantities to match what you have. Everything can be edited later."}</Typography.Paragraph>
      <Button onClick={() => void finish(true)} disabled={busy}>{es ? "Empezar sin precarga" : "Start without a template"}</Button>
    </div>
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
      <legend>{es ? "1. Elegí los ambientes de tu casa" : "1. Choose your rooms"}</legend>
      <Checkbox.Group value={rooms} onChange={(next) => {
        setRooms(next);
        setDestinations(Object.fromEntries(groups.map((id) => [id, next.includes(destinations[id]) ? destinations[id] : next[0] ?? ""])));
      }} style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {ROOM_TEMPLATES.map((room) => <Checkbox key={room.id} value={room.id}>{room.name[locale]}</Checkbox>)}
      </Checkbox.Group>
    </fieldset>
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
      <legend>{es ? "2. Elegí qué querés organizar" : "2. Choose what to organize"}</legend>
      {rooms.length === 0 && <Typography.Paragraph type="secondary">{es ? "Primero elegí un ambiente. También podés guardar ambientes vacíos." : "Choose a room first. Rooms can also be saved empty."}</Typography.Paragraph>}
      <Checkbox.Group value={groups} onChange={chooseGroups} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {HOUSE_TEMPLATES.map((group) => <Checkbox key={group.id} value={group.id} disabled={busy || (rooms.length === 0 && !groups.includes(group.id))}>{group.name[locale]}</Checkbox>)}
      </Checkbox.Group>
      {HOUSE_TEMPLATES.filter((group) => groups.includes(group.id)).map((group) => <label key={group.id} style={{ display: "block", marginTop: 12 }}>
        {es ? "Dónde guardar" : "Location for"} · {group.name[locale]}
        <Select aria-label={`${es ? "Ubicación de" : "Location for"} ${group.name[locale]}`} style={{ width: "100%" }} value={destinations[group.id] || undefined} disabled={busy} options={ROOM_TEMPLATES.filter((room) => rooms.includes(room.id)).map((room) => ({ value: room.id, label: room.name[locale] }))} onChange={(room) => setDestinations({ ...destinations, [group.id]: room })} />
      </label>)}
    </fieldset>
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
      <legend>{es ? "3. Elegí un punto de partida" : "3. Choose a starting point"}</legend>
      <Radio.Group value={level} onChange={(event) => chooseLevel(event.target.value)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Radio value="spaces">{es ? "Solo espacios, sin artículos" : "Spaces only, no items"}</Radio>
        <Radio value="full">{es ? "Compra completa · principio de mes" : "Full shop · start of the month"}</Radio>
        <Radio value="basic">{es ? "Básicos a mano · mediados de mes" : "Basics on hand · mid-month"}</Radio>
        <Radio value="low">{es ? "Queda poco · fin de mes" : "Running low · end of the month"}</Radio>
      </Radio.Group>
      <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>{es
        ? "Son ejemplos editables, no una compra recomendada ni una canasta nutricional. Cambiar de ejemplo restablece sus cantidades. Las unidades de líquidos envasados cuentan envases; revisá su tamaño."
        : "These are editable examples, not a recommended shopping list or nutrition plan. Changing the example resets its quantities. Packaged liquids counted as units mean containers; check their size."}</Typography.Paragraph>
    </fieldset>
    {groups.length > 0 && <div>
      <Typography.Title level={3}>{es ? "Revisá antes de guardar" : "Review before saving"}</Typography.Title>
      <Typography.Paragraph>{es ? `${groups.length} contenedores · ${selectedRows.length} artículos. Podés quitar artículos y cambiar cantidades. Las reposiciones automáticas quedan apagadas para estos ejemplos.`
        : `${groups.length} containers · ${selectedRows.length} items. Remove items and adjust quantities. Automatic replenishment is off for these examples.`}</Typography.Paragraph>
      {rows.length > 0 && <Typography.Paragraph type="secondary">{es ? "Cada precio corresponde a la presentación indicada por el comercio, no al total de tus existencias." : "Each price is for the store's stated pack size, not your total stock."}</Typography.Paragraph>}
      <Collapse items={HOUSE_TEMPLATES.filter((group) => groups.includes(group.id)).map((group) => ({
        key: group.id, label: group.name[locale],
        children: <Flex vertical gap={16}>
          {rows.filter((row) => row.groupId === group.id).length === 0 && <Typography.Text>{es ? "Contenedor vacío" : "Empty container"}</Typography.Text>}
          {rows.filter((row) => row.groupId === group.id).map((row) => {
            const product = setupItem(row, locale);
            const key = rowKey(row);
            return <div key={key}>
              <Flex align="center" gap={8} wrap>
                <Checkbox checked={!omitted.includes(key)} disabled={busy} onChange={(event) => setOmitted(event.target.checked ? omitted.filter((entry) => entry !== key) : [...omitted, key])}>{product.name}</Checkbox>
                <InputNumber aria-label={`${es ? "Cantidad de" : "Quantity of"} ${product.name}`} min={0} max={100000} precision={0} value={row.quantity} disabled={busy || omitted.includes(key)} onChange={(value) => setRows(rows.map((entry) => rowKey(entry) === key ? { ...entry, quantity: value ?? 0 } : entry))} />
                <Typography.Text>{t(`inventory.units.${product.unit as Unit}`, { count: row.quantity })}</Typography.Text>
              </Flex>
              <div style={{ marginTop: 6 }}><ReferencePrice catalogId={row.catalogId} /></div>
            </div>;
          })}
        </Flex>,
      }))} />
    </div>}
    <section>
      <Typography.Title level={3}>{es ? "4. Calendario y escuela (opcional)" : "4. Calendar and school (optional)"}</Typography.Title>
      <CalendarOptions value={calendar} onChange={setCalendar} disabled={busy} />
      <Typography.Paragraph style={{ marginTop: 12 }}>{es ? "Se guarda toda tu selección en un solo paso, o no se guarda nada. Podés cambiar los ambientes y la configuración después." : "Your entire selection is saved in one step, or nothing is saved. Rooms and settings can be changed later."}</Typography.Paragraph>
    </section>
    {error && <Alert type="error" showIcon title={es ? "No se pudo preparar la casa" : "Could not set up this home"} description={es ? "Tu casa puede haber cambiado en otra pestaña o el almacenamiento no está disponible. No se reemplazaron datos. Volvé a entrar para continuar." : "Your home may have changed in another tab or storage is unavailable. No data was replaced. Open your home again to continue."} />}
    <Flex gap={8} wrap>
      <Button type="primary" size="large" loading={busy} disabled={groups.some((id) => !rooms.includes(destinations[id]))} onClick={() => void finish(false)}>{es ? "Guardar esta selección" : "Save this selection"}</Button>
      {onCancel && <Button disabled={busy} onClick={onCancel}>{es ? "Volver" : "Back"}</Button>}
    </Flex>
  </Flex>;
}
