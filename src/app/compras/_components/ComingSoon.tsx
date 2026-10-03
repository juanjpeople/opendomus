"use client";

import { Card, Empty } from "antd";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { PageHeader } from "@/components/ui";

export function ComingSoon() {
  return (
    <RequirePermission perform="shopping.view">
      <PageHeader title="Lista de compras" description="Listas automáticas por stock bajo y listas manuales." />
      <Card>
        <Empty description="Próximamente" />
      </Card>
    </RequirePermission>
  );
}
