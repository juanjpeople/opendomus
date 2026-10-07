"use client";

import { Button, Empty, Flex, Input, Modal, Select, Typography } from "antd";
import { BookOpen, Search } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { CATALOG_CATEGORIES, catalogDefaults, searchCatalog, type CatalogCategory } from "../catalog";
import type { NewInventoryItem } from "../domain";
import { CATEGORY_APPEARANCE } from "../catalog-appearance";
import { IconTile } from "@/components/ui";
import { ReferencePrice } from "@/features/prices/components/ReferencePrice";

export function CatalogPicker({ onSelect }: { onSelect: (values: NewInventoryItem) => void }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CatalogCategory | undefined>();
  const matches = searchCatalog(query, category);
  return (
    <>
      <Button icon={<BookOpen />} onClick={() => setOpen(true)}>{t("inventory.catalog.open")}</Button>
      <Modal open={open} title={t("inventory.catalog.title")} onCancel={() => setOpen(false)} footer={null} width={720}>
        <Typography.Paragraph type="secondary">{t("inventory.catalog.hint")}</Typography.Paragraph>
        <Flex gap={8} wrap style={{ marginBottom: 16 }}>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} prefix={<Search />} allowClear placeholder={t("inventory.catalog.search")} aria-label={t("inventory.catalog.search")} style={{ flex: "1 1 240px" }} />
          <Select value={category} onChange={setCategory} allowClear placeholder={t("inventory.catalog.all")} aria-label={t("inventory.catalog.all")} style={{ minWidth: 180 }} options={CATALOG_CATEGORIES.map((value) => ({ value, label: t(`inventory.catalog.categories.${value}`) }))} />
        </Flex>
        <div style={{ maxHeight: "55vh", overflowY: "auto", padding: 4 }}>
          {matches.length === 0 && <Empty description={t("inventory.catalog.empty")} />}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 8 }}>
            {matches.map((entry) => {
              const { Icon, color } = CATEGORY_APPEARANCE[entry.category];
              return <div key={entry.id}><Button block icon={<IconTile icon={Icon} color={color} size={32} />} style={{ height: "auto", minHeight: 56, padding: 12, justifyContent: "flex-start", whiteSpace: "normal", textAlign: "left" }} onClick={() => { onSelect(catalogDefaults(entry, locale)); setOpen(false); }}>
                <span>{entry.name[locale]}<Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>{t(`inventory.units.${entry.unit}`, { count: 2 })} · {t(entry.durable ? "inventory.catalog.durable" : "inventory.catalog.consumable")}</Typography.Text></span>
              </Button><details style={{ padding: "6px 12px" }}><summary>{locale === "es" ? "Precio de referencia" : "Reference price"}</summary><ReferencePrice catalogId={entry.id} /></details></div>;
            })}
          </div>
        </div>
      </Modal>
    </>
  );
}
