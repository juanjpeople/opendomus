"use client";

import { Button, Card, Flex, theme } from "antd";
import Link from "next/link";
import { HardDrive } from "lucide-react";
import { Reveal } from "@/components/motion";
import { PanelHeader } from "@/components/ui";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useT } from "@/i18n";

export function LocalOnlyPage() {
  const t = useT();
  const { token } = theme.useToken();
  return (
    <PublicLayout width={640}>
      <Reveal><Card><Flex vertical gap={token.marginLG}>
        <PanelHeader icon={HardDrive} title={t("localOnly.title")} description={t("localOnly.description")} />
        <Link href="/empezar"><Button type="primary">{t("localOnly.continue")}</Button></Link>
      </Flex></Card></Reveal>
    </PublicLayout>
  );
}
