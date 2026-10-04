"use client";

import { AutoComplete, Button, Card, Flex, Grid, InputNumber, Select, Tag, Typography, theme, type GetRef } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { Link2, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { StockTag } from "@/components/ui";
import { getStockStatus, isUnit, UNITS, type Unit } from "@/features/inventory/domain";
import { useT } from "@/i18n";
import { SPRING } from "@/lib/motion";
import { SHOPPING_LIMITS, suggestedQuantity } from "../domain";
import { useInventoryOptions, useShoppingActions, type ItemPlace } from "../hooks";

/**
 * Anotar algo en la lista. Si coincide con un producto de la casa, se vincula: al comprarlo
 * entra solo al inventario y la lista muestra dónde va y cuánto salió la última vez.
 */
export function QuickAdd() {
  const t = useT();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const options = useInventoryOptions();
  const { add } = useShoppingActions();
  const inputRef = useRef<GetRef<typeof AutoComplete>>(null);
  // Enter con una sugerencia resaltada la elige; sin sugerencia, anota. Se cuenta cuántas veces se
  // eligió algo y se compara con lo que había al apretar Enter (fase de captura, antes que nadie).
  const selections = useRef(0);
  const selectionsAtEnter = useRef(0);
  const [name, setName] = useState("");
  const [linked, setLinked] = useState<ItemPlace | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<Unit>("unidades");
  const [saving, setSaving] = useState(false);

  const query = name.trim().toLowerCase();
  const matches = query && !linked ? (options ?? []).filter(({ item, place }) => `${item.name} ${place}`.toLowerCase().includes(query)).slice(0, 8) : [];

  function link(option: ItemPlace) {
    selections.current++;
    setLinked(option);
    setName(option.item.name);
    if (isUnit(option.item.unit)) setUnit(option.item.unit);
    setQuantity(suggestedQuantity(option.item));
  }

  function unlink() {
    setLinked(null);
    inputRef.current?.focus();
  }

  async function submit() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const ok = await add({ name, quantity, unit, inventoryItemId: linked?.item.id });
    setSaving(false);
    if (!ok) return;
    setName("");
    setLinked(null);
    setQuantity(1);
    setUnit("unidades");
    inputRef.current?.focus();
  }

  return (
    <Card styles={{ body: { padding: screens.sm ? 16 : 12 } }} style={{ marginBottom: 16 }}>
      <Flex
        gap={8}
        wrap
        align="center"
        onKeyDownCapture={(event) => {
          if (event.key === "Enter") selectionsAtEnter.current = selections.current;
        }}
      >
        <AutoComplete
          ref={inputRef}
          size="large"
          value={name}
          maxLength={SHOPPING_LIMITS.nameMaxLength}
          placeholder={t("shopping.add.placeholder")}
          aria-label={t("shopping.add.placeholder")}
          prefix={<Plus style={{ color: token.colorTextTertiary }} />}
          // El mismo Enter que elige una sugerencia no tiene que anotar.
          onInputKeyDown={(event) => {
            if (event.key === "Enter") setTimeout(() => selections.current === selectionsAtEnter.current && submit());
          }}
          defaultActiveFirstOption={false}
          onChange={(value: string) => {
            // Al elegir una opción, antd manda primero su valor (el id) y después `onSelect` pone el nombre.
            setName(value);
            if (linked && value !== linked.item.name) setLinked(null);
          }}
          onSelect={(id: string) => {
            const option = matches.find((match) => match.item.id === id);
            if (option) link(option);
          }}
          options={matches.map(({ item, place }) => ({
            value: item.id,
            label: (
              <Flex align="center" justify="space-between" gap={12}>
                <span style={{ minWidth: 0 }}>
                  <Typography.Text strong ellipsis style={{ display: "block" }}>
                    {item.name}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ display: "block", fontSize: token.fontSizeSM }} ellipsis>
                    {place}
                  </Typography.Text>
                </span>
                <StockTag status={getStockStatus(item)} />
              </Flex>
            ),
          }))}
          style={{ flex: "1 1 260px", minWidth: 0 }}
        />
        <Flex gap={8} style={{ flex: screens.sm ? "0 0 auto" : "1 1 100%" }}>
          <InputNumber
            size="large"
            aria-label={t("inventory.form.quantity")}
            min={1}
            max={SHOPPING_LIMITS.maxQuantity}
            precision={0}
            value={quantity}
            onChange={(value) => setQuantity(value ?? 1)}
            style={{ width: 84 }}
          />
          <Select<Unit>
            size="large"
            aria-label={t("inventory.form.unit")}
            value={unit}
            onChange={setUnit}
            options={UNITS.map((value) => ({ value, label: t(`inventory.units.${value}`, { count: quantity }) }))}
            style={{ flex: 1, minWidth: 120 }}
          />
          <Button size="large" type="primary" icon={<Plus />} loading={saving} disabled={!name.trim()} onClick={submit}>
            {t("shopping.add.submit")}
          </Button>
        </Flex>
      </Flex>

      <AnimatePresence initial={false}>
        {linked && (
          <motion.div
            key={linked.item.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING.snappy}
            style={{ overflow: "hidden" }}
          >
            <Flex align="center" gap={8} wrap style={{ paddingTop: 10 }}>
              <Tag
                color="processing"
                variant="filled"
                icon={<Link2 />}
                closable
                closeIcon={<X aria-label={t("shopping.add.unlink")} />}
                onClose={(event) => {
                  event.preventDefault();
                  unlink();
                }}
                style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                {t("shopping.add.linked", { place: linked.place })}
              </Tag>
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {t("shopping.add.linkedHint")}
              </Typography.Text>
            </Flex>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
