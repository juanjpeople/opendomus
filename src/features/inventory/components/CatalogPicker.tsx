"use client";

import { App, Button, Flex, Input, Modal, Popover, Typography, theme } from "antd";
import { BookOpen, Search, SearchX, Tag, X } from "lucide-react";
import { useId, useState } from "react";
import { useI18n } from "@/i18n";
import { CATALOG_CATEGORIES, catalogDefaults, searchCatalog, type CatalogCategory } from "../catalog";
import type { NewInventoryItem } from "../domain";
import { CATEGORY_APPEARANCE } from "../catalog-appearance";
import { EmptyState, FilterChips, IconTile, VisualTile } from "@/components/ui";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ReferencePrice } from "@/features/prices/components/ReferencePrice";

export function CatalogPicker({ onSelect }: { onSelect: (values: NewInventoryItem) => void }) {
  const { t, locale } = useI18n();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CatalogCategory | "all">("all");
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const referencePrefix = useId();
  const closeReference = () => {
    setReferenceId(null);
    document.getElementById(`${referencePrefix}-${referenceId}`)?.focus();
  };
  const matches = searchCatalog(query, category === "all" ? undefined : category);
  const close = () => { setOpen(false); setReferenceId(null); };
  return <>
    <Button icon={<BookOpen />} onClick={() => setOpen(true)}>{t("inventory.catalog.open")}</Button>
    <Modal open={open} title={t("inventory.catalog.title")} onCancel={close} footer={null} width={token.screenMD}>
      <Reveal><Typography.Paragraph type="secondary">{t("inventory.catalog.hint")}</Typography.Paragraph></Reveal>
      <Flex vertical gap={token.marginSM}>
        <Input value={query} onChange={(event) => { setQuery(event.target.value); setReferenceId(null); }} prefix={<Search />} allowClear placeholder={t("inventory.catalog.search")} aria-label={t("inventory.catalog.search")} />
        <FilterChips<CatalogCategory | "all"> label={t("inventory.catalog.categoriesLabel")} value={category} onChange={(value) => { setCategory(value); setReferenceId(null); }} options={[
          { value: "all", label: t("inventory.catalog.all") },
          ...CATALOG_CATEGORIES.map((value) => { const { Icon, color } = CATEGORY_APPEARANCE[value]; return { value, label: t(`inventory.catalog.categories.${value}`), color, icon: <Icon /> }; }),
        ]} />
        <Typography.Text type="secondary" role="status">{t("inventory.catalog.matches", { count: matches.length })}</Typography.Text>
        <div key={`${query}:${category}`} style={{ maxHeight: "50vh", overflowY: "auto", padding: token.paddingXXS }}>
          {matches.length === 0 && <EmptyState icon={SearchX} title={t("inventory.catalog.empty")} action={<Button onClick={() => { setQuery(""); setCategory("all"); }}>{t("inventory.catalog.clear")}</Button>} />}
          <Stagger stagger={0} style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${token.controlHeightLG * 4.5}px), 1fr))`, gap: token.marginSM }}>
            {matches.map((entry) => {
              const { Icon, color } = CATEGORY_APPEARANCE[entry.category];
              return <StaggerItem key={entry.id}>
                <Flex vertical gap={token.marginXXS} style={{ height: "100%" }}>
                  <VisualTile color={color} media={<IconTile icon={Icon} color={color} size={token.controlHeightLG} />} title={entry.name[locale]}
                    meta={`${t(`inventory.units.${entry.unit}`, { count: 2 })} · ${t(entry.durable ? "inventory.catalog.durable" : "inventory.catalog.consumable")}`}
                    onClick={() => { onSelect(catalogDefaults(entry, locale)); close(); message.success(t("inventory.catalog.selected", { name: entry.name[locale] })); }} />
                  <Popover trigger="click" open={referenceId === entry.id} onOpenChange={(next) => setReferenceId(next ? entry.id : null)}
                    afterOpenChange={(visible) => { if (visible) document.getElementById(`${referencePrefix}-close-${entry.id}`)?.focus({ preventScroll: true }); }}
                    styles={{ container: { maxWidth: "calc(100vw - 32px)", width: token.screenXS - token.paddingLG * 4 } }}
                    content={<div role="region" aria-label={t("prices.reference.title")} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); closeReference(); } }}>
                      <Flex justify="space-between" align="center" gap={token.marginXS} style={{ marginBottom: token.marginSM }}>
                        <Typography.Text strong>{entry.name[locale]}</Typography.Text>
                        <Button id={`${referencePrefix}-close-${entry.id}`} type="text" icon={<X />} aria-label={t("common.close")} onClick={closeReference} />
                      </Flex>
                      <ReferencePrice catalogId={entry.id} />
                    </div>}>
                    <Button id={`${referencePrefix}-${entry.id}`} type="text" icon={<Tag />} aria-expanded={referenceId === entry.id} aria-label={t("inventory.catalog.referenceFor", { name: entry.name[locale] })}
                      onKeyDown={(event) => { if (event.key === "Escape" && referenceId === entry.id) { event.stopPropagation(); closeReference(); } }}
                      style={{ alignSelf: "flex-start", maxWidth: "100%", whiteSpace: "normal", height: "auto", minHeight: token.controlHeightLG + token.paddingXXS }}>
                      {t("prices.reference.title")}
                    </Button>
                  </Popover>
                </Flex>
              </StaggerItem>;
            })}
          </Stagger>
        </div>
      </Flex>
    </Modal>
  </>;
}
