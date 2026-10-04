"use client";

import { Button, Card } from "antd";
import { ArrowRight, Construction } from "lucide-react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Reveal } from "@/components/motion";
import { EmptyState, PageHeader } from "@/components/ui";
import { useT } from "@/i18n";

export function ComingSoon() {
  const t = useT();

  return (
    <RequirePermission perform="shopping.view">
      <PageHeader eyebrow={t("shopping.eyebrow")} title={t("shopping.title")} description={t("shopping.description")} />
      <Reveal delay={0.15}>
        <Card>
          <EmptyState
            icon={Construction}
            title={t("shopping.emptyTitle")}
            description={t("shopping.emptyText")}
            action={
              <Link href="/bienvenida#hoja-de-ruta">
                <Button icon={<ArrowRight />} iconPlacement="end">
                  {t("shopping.roadmap")}
                </Button>
              </Link>
            }
          />
        </Card>
      </Reveal>
    </RequirePermission>
  );
}
