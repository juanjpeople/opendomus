"use client";

import { Card, Col, Flex, Row, Typography, theme } from "antd";
import { ChartNoAxesColumn } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { Stagger, StaggerItem } from "@/components/motion";
import { PlaceChip, SectionHeader, StatTile } from "@/components/ui";
import { useT } from "@/i18n";
import { db } from "@/lib/db";
import { containerHref } from "@/lib/navigation/routes";
import { summarizeInventory } from "../domain";
import { useTopUsage } from "../hooks";

/**
 * "Tu inventario": insumos que hay, herramientas que tenés, lo que se acaba y, si hay historial,
 * lo que más se usa y cuánto alcanza a ese ritmo. Las herramientas nunca cuentan como faltantes.
 * `wide`: ocupa todo el ancho (las cifras van en una fila desde tablet; si no, de a dos hasta pantallas muy anchas).
 */
export function InventoryInsights({ emptyHidden, wide = false }: { emptyHidden: boolean; wide?: boolean }) {
  const t = useT();
  const { token } = theme.useToken();
  const summary = useLiveQuery(async () => summarizeInventory(await db.inventory.toArray()));
  const usage = useTopUsage();
  if (!summary) return null;

  const tiles = [
    { key: "supplies", label: t("storage.insights.supplies"), value: summary.supplies, tone: "success" as const },
    { key: "tools", label: t("storage.insights.tools"), value: summary.tools, tone: "primary" as const },
    { key: "low", label: t("storage.insights.low"), value: summary.low, tone: "warning" as const },
    { key: "empty", label: t("storage.insights.empty"), value: summary.empty, tone: "error" as const, hint: emptyHidden && summary.empty ? t("storage.insights.emptyHidden") : undefined },
  ];

  return (
    <Card style={{ height: "100%" }}>
      <SectionHeader icon={ChartNoAxesColumn} color="blue" title={t("storage.insights.title")} description={t("storage.insights.description")} />
      <Stagger delay={0.05}>
        <Row gutter={[token.marginSM, token.marginSM]}>
          {tiles.map((tile) => (
            <Col key={tile.key} xs={12} md={wide ? 6 : 12} xxl={6}>
              <StaggerItem style={{ height: "100%" }}>
                <StatTile label={tile.label} value={tile.value} tone={tile.tone} hint={tile.hint} />
              </StaggerItem>
            </Col>
          ))}
        </Row>
      </Stagger>
      {!!usage?.length && (
        <div style={{ marginTop: token.margin }}>
          <Typography.Text strong style={{ display: "block" }}>{t("storage.insights.topUsage")}</Typography.Text>
          <Typography.Text type="secondary" style={{ display: "block", fontSize: token.fontSizeSM, marginBottom: token.marginXS }}>
            {t("storage.insights.topUsageHint")}
          </Typography.Text>
          <Flex wrap gap={token.marginXS}>
            {usage.map((entry) => {
              const detail = entry.daysLeft === null ? undefined : entry.daysLeft === 0 ? t("storage.insights.runOut") : t("storage.insights.daysLeft", { count: entry.daysLeft });
              const used = t("storage.insights.usedTimes", { name: entry.item.name, count: entry.times });
              return (
                <PlaceChip
                  key={entry.item.id}
                  href={containerHref(entry.item.containerId, { item: entry.item.id })}
                  label={entry.item.name}
                  detail={detail}
                  dot={entry.daysLeft !== null && entry.daysLeft <= 7 ? token.colorWarning : token.colorSuccess}
                  title={detail ? `${used} · ${detail}` : used}
                  ariaLabel={detail ? `${used}, ${detail}` : used}
                />
              );
            })}
          </Flex>
        </div>
      )}
    </Card>
  );
}
