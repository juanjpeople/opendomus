"use client";

import { Col, Row, theme } from "antd";
import { Stagger, StaggerItem } from "@/components/motion";
import { StatTile, type StatTone } from "@/components/ui";
import { useT } from "@/i18n";
import { getStockStatus, type StockStatus } from "../domain";
import { useInventoryItems } from "../hooks";

const STATUSES: StockStatus[] = ["ok", "low", "empty"];

/** Resumen por estado de stock. Los números cuentan hasta su valor cuando cambian. */
export function InventoryStats({ containerId }: { containerId: string }) {
  const { token } = theme.useToken();
  const t = useT();
  const items = useInventoryItems(containerId);

  const counts: Record<StockStatus, number> = { ok: 0, low: 0, empty: 0 };
  items?.forEach((item) => counts[getStockStatus(item)]++);

  const tones: Record<StockStatus, StatTone> = { ok: "success", low: "warning", empty: "error" };

  return (
    <Stagger delay={0.1}>
      <Row gutter={[token.marginSM, token.marginSM]} style={{ marginBottom: token.marginLG }}>
        {STATUSES.map((status) => (
          <Col key={status} xs={8}>
            <StaggerItem><StatTile label={t(`inventory.stock.${status}`)} value={counts[status]} tone={tones[status]} /></StaggerItem>
          </Col>
        ))}
      </Row>
    </Stagger>
  );
}
