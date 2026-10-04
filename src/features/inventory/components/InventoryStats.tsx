"use client";

import { Col, Flex, Grid, Row, Typography, theme } from "antd";
import { AnimatedNumber, Stagger, StaggerItem } from "@/components/motion";
import { useT } from "@/i18n";
import { getStockStatus, type StockStatus } from "../domain";
import { useInventoryItems } from "../hooks";

const STATUSES: StockStatus[] = ["ok", "low", "empty"];

/** Resumen por estado de stock. Los números cuentan hasta su valor cuando cambian. */
export function InventoryStats({ containerId }: { containerId: string }) {
  const { token } = theme.useToken();
  const t = useT();
  const screens = Grid.useBreakpoint();
  const items = useInventoryItems(containerId);

  const counts: Record<StockStatus, number> = { ok: 0, low: 0, empty: 0 };
  items?.forEach((item) => counts[getStockStatus(item)]++);

  const colors: Record<StockStatus, string> = { ok: token.colorSuccess, low: token.colorWarning, empty: token.colorError };

  return (
    <Stagger delay={0.1}>
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        {STATUSES.map((status) => (
          <Col key={status} xs={8}>
            <StaggerItem
              style={{
                padding: screens.sm ? "14px 18px" : "12px 8px",
                borderRadius: token.borderRadiusLG,
                border: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorBgContainer,
              }}
            >
              <Flex align="center" gap={screens.sm ? 8 : 4}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: colors[status], flexShrink: 0 }} />
                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, minWidth: 0, overflowWrap: "anywhere" }}>
                  {t(`inventory.stock.${status}`)}
                </Typography.Text>
              </Flex>
              <Typography.Text style={{ fontSize: token.fontSizeHeading3, fontWeight: 600, letterSpacing: "-0.02em" }}>
                <AnimatedNumber value={counts[status]} />
              </Typography.Text>
            </StaggerItem>
          </Col>
        ))}
      </Row>
    </Stagger>
  );
}
