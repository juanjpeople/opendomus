"use client";

import { Button, Card, Typography } from "antd";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useT } from "@/i18n";

export function LocalOnlyPage() {
  const t = useT();
  return (
    <PublicLayout width={640}>
      <Card>
        <Typography.Title level={1}>{t("localOnly.title")}</Typography.Title>
        <Typography.Paragraph>{t("localOnly.description")}</Typography.Paragraph>
        <Link href="/empezar"><Button type="primary">{t("localOnly.continue")}</Button></Link>
      </Card>
    </PublicLayout>
  );
}
