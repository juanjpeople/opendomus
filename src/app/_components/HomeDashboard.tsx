"use client";

import { Card, Col, Flex, Row, Statistic, Typography, theme } from "antd";
import { Refrigerator, ShoppingCart, Wrench, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { INVENTORY_TYPES, type InventoryType } from "@/features/inventory/domain";
import { useInventorySummary } from "@/features/inventory/hooks";
import { useCurrentUser } from "@/lib/auth/session";

export function HomeDashboard() {
  const user = useCurrentUser();

  return (
    <>
      <PageHeader title={`Hola, ${user?.name ?? ""} 👋`} description="El sistema operativo de tu casa, offline-first." />
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <InventoryCard type="alacena" icon={Refrigerator} />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <InventoryCard type="taller" icon={Wrench} />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <DashboardCard href="/compras" icon={ShoppingCart} title="Lista de compras">
            <Statistic value="Próximamente" />
          </DashboardCard>
        </Col>
      </Row>
    </>
  );
}

function InventoryCard({ type, icon }: { type: InventoryType; icon: LucideIcon }) {
  const summary = useInventorySummary(type);
  const config = INVENTORY_TYPES[type];

  return (
    <DashboardCard href={`/${type}`} icon={icon} title={config.label}>
      <Statistic value={summary?.total ?? 0} suffix={config.itemNounPlural} loading={!summary} />
      {!!summary?.needsAttention && (
        <Typography.Text type="warning">{summary.needsAttention} con stock bajo o agotado</Typography.Text>
      )}
    </DashboardCard>
  );
}

function DashboardCard({
  href,
  icon: Icon,
  title,
  children,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  const { token } = theme.useToken();

  return (
    <Link href={href} style={{ display: "block", height: "100%" }}>
      <Card hoverable style={{ height: "100%" }}>
        <Flex gap={16} align="flex-start">
          <Flex
            align="center"
            justify="center"
            style={{
              width: 48,
              height: 48,
              flexShrink: 0,
              borderRadius: token.borderRadiusLG,
              background: token.colorPrimaryBg,
              color: token.colorPrimary,
              fontSize: 24,
            }}
          >
            <Icon />
          </Flex>
          <Flex vertical>
            <Typography.Text type="secondary">{title}</Typography.Text>
            {children}
          </Flex>
        </Flex>
      </Card>
    </Link>
  );
}
